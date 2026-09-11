import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState as NativeAppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppState,
  Profile,
  Workout,
  ActiveWorkout,
  WorkoutRecord,
} from "./types";
import { createSession, isAppState } from "./data";
import {
  Auth,
  isAuth,
  readAuth,
  saveAuth,
  request,
  RequestError,
} from "./lib/api";
import { initializePurchases } from "./lib/purchases";
import { routineStorageKey } from "./lib/routines";
import {
  accountStorageKeys,
  cacheKey,
  freshState,
  hasGuestData,
  LocalCache,
  makeCache,
  mergeAccountState,
  mergeGuestState,
  parseCache,
  resetState,
  sameState,
} from "./lib/sync";

type RemoteState = { state: unknown; updatedAt: string | null };
type Store = {
  state: AppState;
  ready: boolean;
  auth: Auth | null;
  syncStatus: string;
  error: string;
  setError: (message: string) => void;
  setProfile: (profile: Profile) => void;
  startWorkout: (workout: Workout) => void;
  updateActive: (workout: ActiveWorkout) => void;
  finishWorkout: () => WorkoutRecord | null;
  discardWorkout: () => void;
  toggleSaved: (id: string) => void;
  authenticate: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  sync: () => Promise<void>;
  reset: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
};
const Context = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(freshState);
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [syncStatus, setSyncStatus] = useState("Saved on this device");
  const [error, setError] = useState("");
  const cache = useRef<LocalCache>(makeCache(null));
  const currentAuth = useRef<Auth | null>(null);
  const verifiedToken = useRef<string | null>(null);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const initialized = useRef(false);
  const needsPull = useRef(false);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const transitionQueue = useRef<Promise<void>>(Promise.resolve());
  const transitioning = useRef(false);
  const flight = useRef<{ epoch: number; task: Promise<void> } | null>(null);

  function install(next: LocalCache) {
    const changed = !sameState(cache.current.state, next.state);
    cache.current = next;
    if (mounted.current && changed) setState(next.state);
  }
  function persist(next: LocalCache): Promise<void> {
    // Ownership is captured with each snapshot, never read after an async wait.
    const key = cacheKey(next.ownerId);
    const serialized = JSON.stringify(next);
    const operation = writeQueue.current.then(() =>
      AsyncStorage.setItem(key, serialized),
    );
    writeQueue.current = operation.catch(() => {
      if (mounted.current)
        setError(
          "Your latest changes could not be saved to this device. Keep the app open and try again.",
        );
    });
    return operation;
  }
  async function backup(next: LocalCache, reason: string) {
    await writeQueue.current;
    await AsyncStorage.setItem(
      `forma-recovery-v2:${reason}:${next.ownerId ?? "guest"}`,
      JSON.stringify(next),
    );
  }
  async function readCache(ownerId: string | null): Promise<LocalCache | null> {
    const raw = await AsyncStorage.getItem(cacheKey(ownerId));
    const parsed = parseCache(raw, ownerId);
    if (raw && !parsed) {
      await AsyncStorage.setItem(
        `forma-recovery-v2:unreadable:${ownerId ?? "guest"}:${Date.now()}`,
        raw,
      );
      if (mounted.current)
        setError(
          "A saved cache could not be read. A recovery copy has been kept on this device.",
        );
    }
    return parsed;
  }
  function commit(update: (previous: AppState) => AppState) {
    if (!initialized.current) return;
    if (transitioning.current) {
      setError("Your account changes are still saving. Try again in a moment.");
      return;
    }
    const nextState = update(cache.current.state);
    if (sameState(nextState, cache.current.state)) return;
    const next = {
      ...cache.current,
      state: nextState,
      dirty: true,
      updatedAt: Math.max(Date.now(), cache.current.updatedAt + 1),
    };
    install(next);
    void persist(next).catch(() => {});
    setSyncStatus(
      currentAuth.current
        ? "Saved locally · sync pending"
        : "Saved on this device",
    );
  }
  function activeOperation(generation: number, account: Auth): boolean {
    return (
      mounted.current &&
      epoch.current === generation &&
      currentAuth.current?.token === account.token &&
      cache.current.ownerId === account.user.id
    );
  }
  async function verifyAccount(account: Auth) {
    if (verifiedToken.current === account.token) return;
    const result = await request<{ user: { id: string } }>("/api/auth/me", {
      token: account.token,
    });
    if (result.user?.id !== account.user.id)
      throw new RequestError(
        "Your saved session does not match this account. Sign in again; your local data has been kept.",
        401,
        "identity_mismatch",
      );
    if (currentAuth.current?.token === account.token)
      verifiedToken.current = account.token;
  }

  async function sync(): Promise<void> {
    const account = currentAuth.current;
    if (
      !account ||
      !initialized.current ||
      transitioning.current ||
      cache.current.ownerId !== account.user.id
    )
      return;
    const generation = epoch.current;
    const pending = flight.current;
    if (pending?.epoch === generation) {
      await pending.task;
      return;
    }
    const task = (async () => {
      setSyncStatus("Syncing…");
      try {
        await persist(cache.current);
        await verifyAccount(account);
        if (!activeOperation(generation, account)) return;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const remote = await request<RemoteState>("/api/workout-state", {
            token: account.token,
          });
          if (!activeOperation(generation, account)) return;
          if (remote.state !== null && !isAppState(remote.state))
            throw new Error(
              "Your account data could not be read. Your local workouts have been kept.",
            );
          const snapshot = cache.current;
          const merged = remote.state
            ? mergeAccountState(snapshot.state, remote.state, snapshot.dirty)
            : snapshot.state;
          if (
            snapshot.state.active &&
            snapshot.state.active.id !== merged.active?.id &&
            !merged.history.some(
              (record) => record.id === snapshot.state.active!.id,
            )
          )
            await backup(snapshot, "before-merge");
          let updatedAt = remote.updatedAt;
          const shouldUpload =
            remote.state === null ||
            snapshot.dirty ||
            !sameState(merged, remote.state as AppState);
          if (shouldUpload) {
            try {
              const saved = await request<RemoteState>("/api/workout-state", {
                method: "PUT",
                token: account.token,
                body: { state: merged, expectedUpdatedAt: remote.updatedAt },
              });
              updatedAt = saved.updatedAt;
            } catch (problem) {
              if (
                problem instanceof RequestError &&
                problem.status === 409 &&
                attempt < 2
              )
                continue;
              throw problem;
            }
          }
          if (!activeOperation(generation, account)) return;
          const changedDuringUpload =
            cache.current.updatedAt !== snapshot.updatedAt;
          const next: LocalCache = {
            ...cache.current,
            state: changedDuringUpload
              ? mergeAccountState(cache.current.state, merged, true)
              : merged,
            dirty: changedDuringUpload,
            remoteUpdatedAt: updatedAt,
          };
          install(next);
          await persist(next);
          if (!activeOperation(generation, account)) return;
          if (shouldUpload)
            await request("/api/profile", {
              method: "PUT",
              token: account.token,
              body: { profile: merged.profile },
            });
          if (!activeOperation(generation, account)) return;
          needsPull.current = false;
          setSyncStatus(
            cache.current.dirty
              ? "Saved locally · sync pending"
              : "Synced to your account",
          );
          return;
        }
      } catch (problem) {
        if (activeOperation(generation, account)) {
          needsPull.current = true;
          cache.current = { ...cache.current, dirty: true };
          void persist(cache.current).catch(() => {});
          setSyncStatus(
            problem instanceof RequestError && problem.status === 401
              ? "Session expired · workouts saved locally"
              : "Saved locally · sync pending",
          );
        }
        throw problem;
      }
    })();
    flight.current = { epoch: generation, task };
    try {
      await task;
      if (activeOperation(generation, account) && cache.current.dirty)
        setTimeout(() => {
          if (activeOperation(generation, account)) void sync().catch(() => {});
        }, 900);
    } finally {
      if (flight.current?.task === task) flight.current = null;
    }
  }

  async function transition(operation: () => Promise<void>): Promise<void> {
    const task = transitionQueue.current.then(async () => {
      transitioning.current = true;
      epoch.current += 1;
      try {
        await flight.current?.task.catch(() => {});
        await persist(cache.current);
        await operation();
      } finally {
        transitioning.current = false;
      }
    });
    transitionQueue.current = task.catch(() => {});
    return task;
  }

  useEffect(() => {
    mounted.current = true;
    let alive = true;
    void (async () => {
      try {
        const account = await readAuth();
        const legacy = await AsyncStorage.getItem("forma-state-v1");
        if (
          legacy &&
          !(await AsyncStorage.getItem("forma-state-v2:migrated"))
        ) {
          const previousId = await AsyncStorage.getItem("forma-last-account");
          await AsyncStorage.setItem("forma-recovery-v2:legacy", legacy);
          try {
            const old = JSON.parse(legacy);
            const ownerId = previousId ?? null;
            if (
              isAppState(old) &&
              !(await AsyncStorage.getItem(cacheKey(ownerId)))
            )
              await persist(makeCache(ownerId, old, true));
          } catch {
            /* Raw recovery copy is retained. */
          }
          await AsyncStorage.setItem("forma-state-v2:migrated", "1");
        }
        const selected =
          (await readCache(account?.user.id ?? null)) ??
          makeCache(account?.user.id ?? null, freshState(account?.user.name));
        if (!alive) return;
        currentAuth.current = account;
        install(selected);
        setAuth(account);
        needsPull.current = !!account;
        setSyncStatus(
          account ? "Saved locally · checking account" : "Saved on this device",
        );
        initializePurchases(account?.user.id ?? null).catch(() => {});
      } catch {
        if (alive)
          setError(
            "Device storage is unavailable. Keep this window open to preserve this session.",
          );
      } finally {
        if (alive) {
          initialized.current = true;
          setReady(true);
        }
      }
    })();
    return () => {
      alive = false;
      mounted.current = false;
      epoch.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!ready || !auth || (!cache.current.dirty && !needsPull.current)) return;
    const timer = setTimeout(() => {
      void sync().catch(() => {});
    }, 900);
    return () => clearTimeout(timer);
  }, [state, auth, ready]);
  useEffect(() => {
    const retry = () => {
      if (currentAuth.current && (cache.current.dirty || needsPull.current))
        void sync().catch(() => {});
    };
    const timer = setInterval(retry, 30_000);
    const listener = NativeAppState.addEventListener("change", (next) => {
      if (next === "active") {
        needsPull.current = !!currentAuth.current;
        retry();
      }
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);

  async function authenticate(email: string, password: string, name?: string) {
    await transition(async () => {
      const result = await request<Auth>(
        name !== undefined ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          body: { email, password, ...(name !== undefined ? { name } : {}) },
        },
      );
      if (!isAuth(result))
        throw new Error(
          "The account service returned an invalid session. Your local data is unchanged.",
        );
      const remote = await request<RemoteState>("/api/workout-state", {
        token: result.token,
      });
      if (remote.state !== null && !isAppState(remote.state))
        throw new Error(
          "Your account data could not be read. Your local workouts have been kept.",
        );
      const prior = await readCache(result.user.id);
      if (prior) await backup(prior, "before-restore");
      let combined = prior?.state ?? freshState(result.user.name);
      if (remote.state)
        combined = prior
          ? mergeAccountState(combined, remote.state, prior.dirty)
          : remote.state;
      const guest =
        cache.current.ownerId === null && hasGuestData(cache.current.state)
          ? cache.current
          : null;
      if (guest) {
        await backup({ ...guest, ownerId: result.user.id }, "guest-import");
        combined = mergeGuestState(guest.state, combined);
      }
      if (!combined.profile.name)
        combined = {
          ...combined,
          profile: { ...combined.profile, name: result.user.name },
        };
      const next: LocalCache = {
        ...makeCache(result.user.id, combined, true),
        remoteUpdatedAt: remote.updatedAt,
      };
      await persist(next);
      if (guest) await persist(makeCache(null));
      try {
        await saveAuth(result);
      } catch (problem) {
        if (guest) await persist(guest);
        throw problem;
      }
      currentAuth.current = result;
      verifiedToken.current = result.token;
      install(next);
      setAuth(result);
      needsPull.current = true;
      setSyncStatus("Saved locally · sync pending");
      initializePurchases(result.user.id).catch(() => {});
    });
    await sync().catch(() => {});
  }

  async function signOut() {
    await transition(async () => {
      const previous = currentAuth.current;
      const guest = (await readCache(null)) ?? makeCache(null);
      await persist(guest);
      await saveAuth(null);
      currentAuth.current = null;
      verifiedToken.current = null;
      install(guest);
      setAuth(null);
      needsPull.current = false;
      setSyncStatus("Saved on this device");
      initializePurchases(null).catch(() => {});
      if (previous)
        await request("/api/auth/logout", {
          method: "POST",
          token: previous.token,
        }).catch(() => {});
    });
  }

  async function reset() {
    await transition(async () => {
      const previous = cache.current;
      await backup(previous, "before-reset");
      const empty = resetState();
      let remoteUpdatedAt: string | null = null;
      const account = currentAuth.current;
      if (account) {
        await verifyAccount(account);
        const remote = await request<RemoteState>("/api/workout-state", {
          token: account.token,
        });
        const saved = await request<RemoteState>("/api/workout-state", {
          method: "PUT",
          token: account.token,
          body: { state: empty, expectedUpdatedAt: remote.updatedAt },
        });
        remoteUpdatedAt = saved.updatedAt;
      }
      const next = {
        ...makeCache(previous.ownerId, empty, !!account),
        remoteUpdatedAt,
      };
      await persist(next);
      install(next);
      needsPull.current = !!account;
      setSyncStatus(
        account ? "Saved locally · sync pending" : "Saved on this device",
      );
    });
    await sync().catch(() => {});
  }

  async function deleteAccount(password: string) {
    await transition(async () => {
      const account = currentAuth.current;
      if (!account) throw new Error("Sign in before deleting your account.");
      await verifyAccount(account);
      // Prepare device cleanup before making the irreversible server request.
      // The separate guest cache and every other account remain untouched.
      const allKeys = await AsyncStorage.getAllKeys();
      const candidates = allKeys.filter(
        (key) =>
          key.startsWith("forma-state-") ||
          key.startsWith("forma-recovery-v2:") ||
          key === "forma-last-account",
      );
      const entries = await AsyncStorage.multiGet(candidates);
      const keysToDelete = [
        ...accountStorageKeys(account.user.id, entries),
        routineStorageKey(account.user.id),
      ];
      const guest = (await readCache(null)) ?? makeCache(null);
      await request("/api/account", {
        method: "DELETE",
        token: account.token,
        body: { password },
      });
      // No old upload or subsequent retry may restore deleted data, even if
      // secure-storage or device cleanup fails after the server confirms deletion.
      epoch.current += 1;
      currentAuth.current = null;
      verifiedToken.current = null;
      needsPull.current = false;
      install(guest);
      setAuth(null);
      setSyncStatus("Saved on this device");
      initializePurchases(null).catch(() => {});
      const cleanup = await Promise.allSettled([
        saveAuth(null),
        AsyncStorage.multiRemove(keysToDelete),
      ]);
      if (cleanup.some((result) => result.status === "rejected")) {
        const message =
          "Your account was deleted, but some device data could not be removed. Clear FORMA’s app storage on this device to finish cleanup.";
        setError(message);
        throw new Error(message);
      }
    });
  }

  function finishWorkout(): WorkoutRecord | null {
    const active = cache.current.state.active;
    if (!active || !active.sets.some((set) => set.done)) return null;
    const record: WorkoutRecord = {
      ...active,
      completedAt: new Date().toISOString(),
      durationSeconds: Math.max(
        1,
        Math.round((Date.now() - Date.parse(active.startedAt)) / 1000),
      ),
    };
    commit((previous) => ({
      ...previous,
      active: null,
      history: [
        record,
        ...previous.history.filter((item) => item.id !== record.id),
      ],
    }));
    return record;
  }
  return (
    <Context.Provider
      value={{
        state,
        ready,
        auth,
        syncStatus,
        error,
        setError,
        setProfile: (profile) =>
          commit((previous) => ({ ...previous, profile })),
        startWorkout: (workout) =>
          commit((previous) =>
            previous.active
              ? previous
              : {
                  ...previous,
                  active: createSession(
                    workout,
                    previous.profile,
                    previous.history,
                  ),
                },
          ),
        updateActive: (active) =>
          commit((previous) =>
            previous.active?.id === active.id
              ? { ...previous, active }
              : previous,
          ),
        finishWorkout,
        discardWorkout: () =>
          commit((previous) => ({ ...previous, active: null })),
        toggleSaved: (id) =>
          commit((previous) => ({
            ...previous,
            saved: previous.saved.includes(id)
              ? previous.saved.filter((item) => item !== id)
              : [...previous.saved, id],
          })),
        authenticate,
        signOut,
        sync,
        reset,
        deleteAccount,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useStore = () => {
  const store = useContext(Context);
  if (!store) throw new Error("Store is missing");
  return store;
};
