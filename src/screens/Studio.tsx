import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Dumbbell,
  LockKeyhole,
  Minus,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react-native";
import {
  Button,
  Card,
  Eyebrow,
  FadeIn,
  IconButton,
  Sheet,
  Title,
  Txt,
  styles as u,
} from "../components/UI";
import { exercises, estimateWorkoutMinutes } from "../data";
import { colors as c, fonts as f } from "../theme";
import { Workout } from "../types";
import { useStore } from "../store";
import { Auth, request, RequestError } from "../lib/api";
import { exerciseMetadata } from "../lib/training";
import {
  CustomRoutine,
  RoutineExercise,
  MAX_ROUTINE_EXERCISES,
  MAX_ROUTINES,
  deleteRoutine,
  duplicateRoutine,
  exerciseForRoutine,
  isCustomRoutine,
  isRoutineList,
  mergeRoutines,
  newRoutine,
  parseRoutines,
  reorderRoutineExercise,
  routineStorageKey,
  routineToWorkout,
  serializeRoutines,
} from "../lib/routines";

type RoutineResponse = { routines: CustomRoutine[]; updatedAt: number | null };
type Scope = {
  identity: string;
  ownerId: string | null;
  auth: Auth | null;
  routines: CustomRoutine[];
  ready: boolean;
  syncing: boolean;
  again: boolean;
};
type LibraryView = {
  identity: string;
  routines: CustomRoutine[];
  ready: boolean;
  status: string;
  error: string;
};

function validResponse(value: RoutineResponse): boolean {
  return (
    !!value &&
    isRoutineList(value.routines) &&
    (value.updatedAt === null ||
      (typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)))
  );
}

/** Each read, write and request keeps the owner it started with, including during sign-out. */
function useRoutineLibrary(auth: Auth | null, preview: boolean) {
  const identity = (auth?.user.id || "guest") + ":" + (auth?.token || "");
  const active = useRef<Scope | null>(null);
  const localQueue = useRef<Promise<unknown>>(Promise.resolve());
  const previewRef = useRef(preview);
  previewRef.current = preview;
  const [view, setView] = useState<LibraryView>({
    identity: "",
    routines: [],
    ready: false,
    status: "Opening your library…",
    error: "",
  });

  function current(scope: Scope) {
    return active.current === scope;
  }
  function update(scope: Scope, patch: Partial<LibraryView>) {
    if (current(scope))
      setView((previous) => ({
        ...previous,
        ...patch,
        identity: scope.identity,
      }));
  }
  function writeLocal(
    scope: Scope,
    updater: (previous: CustomRoutine[]) => CustomRoutine[],
  ): Promise<CustomRoutine[]> {
    const task = localQueue.current.then(async () => {
      if (!current(scope))
        throw new Error("Your account changed. Reopen Studio to continue.");
      const next = updater(scope.routines);
      await AsyncStorage.setItem(
        routineStorageKey(scope.ownerId),
        serializeRoutines(next, scope.ownerId),
      );
      if (current(scope)) {
        scope.routines = next;
        update(scope, { routines: next, ready: true });
      }
      return next;
    });
    localQueue.current = task.catch(() => {});
    return task;
  }

  async function sync(scope = active.current): Promise<void> {
    if (!scope || !scope.auth || !scope.ready || !current(scope)) return;
    if (scope.syncing) {
      scope.again = true;
      return;
    }
    scope.syncing = true;
    scope.again = false;
    const token = scope.auth.token;
    const previewAtStart = previewRef.current;
    update(scope, { status: "Syncing your routines…", error: "" });
    try {
      let remote = await request<RoutineResponse>("/api/routines", { token });
      if (!validResponse(remote))
        throw new Error(
          "Your account returned a routine library that could not be read.",
        );
      if (!current(scope)) return;
      let merged = await writeLocal(scope, (local) =>
        mergeRoutines(local, remote.routines),
      );
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!current(scope)) return;
        if (
          JSON.stringify(mergeRoutines([], remote.routines)) ===
          JSON.stringify(merged)
        )
          break;
        try {
          remote = await request<RoutineResponse>("/api/routines", {
            method: "PUT",
            token,
            body: {
              routines: merged,
              expectedUpdatedAt: remote.updatedAt,
              ...(previewAtStart ? { preview: true } : {}),
            },
          });
          if (!validResponse(remote))
            throw new Error(
              "Your routines are saved here, but account sync returned an unreadable result.",
            );
          break;
        } catch (error) {
          if (
            !(error instanceof RequestError) ||
            error.status !== 409 ||
            attempt === 1
          )
            throw error;
          remote = await request<RoutineResponse>("/api/routines", { token });
          if (!validResponse(remote))
            throw new Error("Your updated account library could not be read.");
          merged = await writeLocal(scope, (local) =>
            mergeRoutines(local, remote.routines),
          );
        }
      }
      if (!current(scope)) return;
      const final = await writeLocal(scope, (local) =>
        mergeRoutines(local, remote.routines),
      );
      const unsent =
        JSON.stringify(final) !==
        JSON.stringify(mergeRoutines([], remote.routines));
      if (unsent) scope.again = true;
      update(scope, {
        status: unsent ? "Saved here · sync pending" : "Synced to your account",
        error: "",
      });
    } catch (error) {
      scope.again = false;
      update(scope, {
        status: "Saved on this device · sync pending",
        error:
          error instanceof RequestError && error.status === 403
            ? "Your routines are saved on this device. An active FORMA Plus membership is needed to sync changes."
            : error instanceof Error
              ? error.message
              : "Your routines are saved here. Try syncing again when you are connected.",
      });
    } finally {
      scope.syncing = false;
      if (scope.again && current(scope)) void sync(scope);
    }
  }

  useEffect(() => {
    const scope: Scope = {
      identity,
      ownerId: auth?.user.id || null,
      auth,
      routines: [],
      ready: false,
      syncing: false,
      again: false,
    };
    active.current = scope;
    setView({
      identity,
      routines: [],
      ready: false,
      status: "Opening your library…",
      error: "",
    });
    const opening = localQueue.current.then(async () => {
      const raw = await AsyncStorage.getItem(routineStorageKey(scope.ownerId));
      const cached = parseRoutines(raw, scope.ownerId);
      if (cached === null)
        throw new Error(
          "Your saved routine library could not be read. It has been kept on this device for recovery.",
        );
      if (!current(scope)) return;
      scope.routines = cached;
      scope.ready = true;
      update(scope, {
        routines: cached,
        ready: true,
        status: scope.auth
          ? "Saved here · checking account"
          : "Saved on this device",
      });
    });
    localQueue.current = opening.catch(() => {});
    void opening
      .then(() => sync(scope))
      .catch((error) =>
        update(scope, {
          error: error.message,
          status: "Unable to open library",
        }),
      );
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync(scope);
    });
    return () => {
      if (current(scope)) active.current = null;
      foreground.remove();
    };
  }, [identity]);

  async function save(routine: CustomRoutine) {
    const scope = active.current;
    if (!scope || scope.identity !== identity || !scope.ready)
      throw new Error("Your library is still opening. Try again in a moment.");
    if (!isCustomRoutine(routine))
      throw new Error(
        "Add a name and between 1 and 12 exercises before saving.",
      );
    await writeLocal(scope, (previous) => mergeRoutines(previous, [routine]));
    update(scope, {
      status: scope.auth ? "Saved here · sync pending" : "Saved on this device",
      error: "",
    });
    void sync(scope);
  }
  const safeView =
    view.identity === identity
      ? view
      : {
          identity,
          routines: [],
          ready: false,
          status: "Opening your library…",
          error: "",
        };
  return { ...safeView, save, sync: () => sync() };
}

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={[u.between, { gap: 12 }]}>
      <Txt style={{ fontFamily: f.medium }}>{label}</Txt>
      <View style={[u.row, { gap: 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Decrease " + label}
          accessibilityState={{ disabled: value <= min }}
          disabled={value <= min}
          onPress={() => onChange(Math.max(min, value - step))}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: c.bg,
            justifyContent: "center",
            alignItems: "center",
            opacity: value <= min ? 0.3 : pressed ? 0.6 : 1,
          })}
        >
          <Minus aria-hidden size={17} color={c.ink} />
        </Pressable>
        <Txt
          accessibilityLiveRegion="polite"
          style={{
            width: 38,
            textAlign: "center",
            fontFamily: f.bold,
            fontSize: 16,
          }}
        >
          {value}
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Increase " + label}
          accessibilityState={{ disabled: value >= max }}
          disabled={value >= max}
          onPress={() => onChange(Math.min(max, value + step))}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: c.bg,
            justifyContent: "center",
            alignItems: "center",
            opacity: value >= max ? 0.3 : pressed ? 0.6 : 1,
          })}
        >
          <Plus aria-hidden size={17} color={c.ink} />
        </Pressable>
      </View>
    </View>
  );
}

export function Studio({
  pro,
  onUpgrade,
  onStart,
  preview = false,
}: {
  pro: boolean;
  onUpgrade: () => void;
  onStart: (workout: Workout) => void;
  preview?: boolean;
}) {
  const { auth, state } = useStore();
  const library = useRoutineLibrary(auth, preview);
  const { width } = useWindowDimensions();
  const [draft, setDraft] = useState<CustomRoutine | null>(null);
  const [original, setOriginal] = useState("");
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("All");
  const [equipmentOnly, setEquipmentOnly] = useState(true);
  const [picker, setPicker] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [discard, setDiscard] = useState(false);
  const [deleting, setDeleting] = useState<CustomRoutine | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const owner = auth?.user.id || "guest";
  useEffect(() => {
    setDraft(null);
    setDeleting(null);
    setDiscard(false);
    setNotice("");
  }, [owner]);
  const routines = library.routines
    .filter((routine) => !routine.deletedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const groups = [
    "All",
    ...new Set(exercises.map((exercise) => exercise.muscle)),
  ];
  const filtered = exercises.filter(
    (exercise) =>
      (muscle === "All" || exercise.muscle === muscle) &&
      (!equipmentOnly ||
        ((state.profile.equipment === "Full gym" ||
          exercise.equipment === "Any" ||
          exercise.equipment === "Bodyweight" ||
          exercise.equipment === state.profile.equipment) &&
          (!exerciseMetadata[exercise.id]?.bench ||
            state.profile.equipment === "Full gym"))) &&
      (exercise.name + " " + exercise.muscle + " " + exercise.equipment)
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const draftWorkout = draft ? routineToWorkout(draft) : null;
  const estimate =
    draftWorkout && draft?.exercises.length
      ? estimateWorkoutMinutes(draftWorkout, state.profile)
      : 0;
  const dirty = draft !== null && JSON.stringify(draft) !== original;

  function edit(routine?: CustomRoutine) {
    if (!pro) {
      onUpgrade();
      return;
    }
    const next = routine
      ? {
          ...routine,
          exercises: routine.exercises.map((exercise) => ({ ...exercise })),
        }
      : {
          ...newRoutine(),
          minutes: ([30, 45, 60].includes(state.profile.duration)
            ? state.profile.duration
            : 45) as 30 | 45 | 60,
        };
    setDraft(next);
    setOriginal(JSON.stringify(next));
    setPicker(false);
    setExpanded(null);
    setQuery("");
    setMuscle("All");
    setEditorError("");
    setDiscard(false);
  }
  function closeEditor() {
    if (busy) return;
    if (dirty) setDiscard(true);
    else setDraft(null);
  }
  function updateExercise(index: number, change: Partial<RoutineExercise>) {
    setDraft(
      (previous) =>
        previous && {
          ...previous,
          exercises: previous.exercises.map((exercise, at) =>
            at === index ? { ...exercise, ...change } : exercise,
          ),
        },
    );
  }
  async function saveEditor() {
    if (!draft || busy) return;
    if (!pro) {
      onUpgrade();
      return;
    }
    const next = {
      ...draft,
      name: draft.name.trim(),
      updatedAt: Math.max(Date.now(), draft.updatedAt + 1),
    };
    if (!next.name) {
      setEditorError("Give your routine a name.");
      return;
    }
    if (!isCustomRoutine(next)) {
      setEditorError("Choose at least one exercise to build your routine.");
      return;
    }
    setBusy(true);
    setEditorError("");
    try {
      await library.save(next);
      setDraft(null);
      setNotice("Routine saved. Your next session is ready.");
      if (Platform.OS !== "web")
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
    } catch (error) {
      setEditorError(
        error instanceof Error
          ? error.message
          : "Your routine could not be saved. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy(routine: CustomRoutine) {
    if (!pro) {
      onUpgrade();
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await library.save(duplicateRoutine(routine));
      setNotice("A separate copy is ready to make your own.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "The copy could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setDeleteError("");
    try {
      await library.save(deleteRoutine(deleting));
      setDeleting(null);
      setNotice(
        "Routine deleted. Your completed workouts are still in Progress.",
      );
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "The routine could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 26 }}>
      <View style={[u.between, { flexWrap: "wrap" }]}>
        <View style={{ gap: 9, flex: 1, minWidth: 220 }}>
          <Eyebrow style={{ color: c.orangeDark }}>THE FORMA STUDIO</Eyebrow>
          <Title>Training, on your terms.</Title>
          <Txt muted style={{ fontSize: 15 }}>
            Build the session you want to come back to.
          </Txt>
        </View>
        <Button
          onPress={() => edit()}
          disabled={
            !library.ready || busy || library.routines.length >= MAX_ROUTINES
          }
          icon={
            pro ? (
              <Plus aria-hidden size={18} color="white" />
            ) : (
              <LockKeyhole aria-hidden size={17} color="white" />
            )
          }
        >
          {pro ? "New routine" : "Unlock Studio"}
        </Button>
      </View>

      <FadeIn>
        <Card
          style={{
            backgroundColor: c.dark,
            padding: width < 600 ? 24 : 34,
            borderWidth: 0,
            overflow: "hidden",
          }}
        >
          <View style={[u.between, { flexWrap: "wrap", gap: 28 }]}>
            <View style={{ flex: 1, minWidth: 220, gap: 18 }}>
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: "#3B463D",
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                }}
              >
                <Eyebrow style={{ color: "#DDE8D2", letterSpacing: 1.2 }}>
                  FORMA PLUS {preview ? "· PREVIEW" : ""}
                </Eyebrow>
              </View>
              <Txt
                style={{
                  color: c.cream,
                  fontFamily: f.heavy,
                  fontSize: width < 600 ? 29 : 35,
                  lineHeight: width < 600 ? 37 : 44,
                  letterSpacing: -1.1,
                  maxWidth: 430,
                }}
              >
                Your favorite moves.{"\n"}Your own flow.
              </Txt>
              <Txt
                style={{
                  color: "#D0D9CB",
                  fontSize: 15,
                  lineHeight: 23,
                  maxWidth: 440,
                }}
              >
                Choose your exercises. Dial in every set, rep and rest. Save a
                routine that feels like you.
              </Txt>
              {!pro && (
                <Button
                  onPress={onUpgrade}
                  kind="light"
                  style={{ alignSelf: "flex-start" }}
                  icon={<ArrowUpRight aria-hidden size={18} color={c.ink} />}
                >
                  Make it yours with Plus
                </Button>
              )}
            </View>
            <View
              style={{
                gap: 12,
                width: width >= 1100 ? 275 : "100%",
                maxWidth: 410,
              }}
            >
              {[
                {
                  icon: (
                    <SlidersHorizontal aria-hidden size={19} color="#DDE8D2" />
                  ),
                  title: "Your prescription",
                  detail: "Set the reps, sets and recovery.",
                },
                {
                  icon: <Dumbbell aria-hidden size={19} color="#DDE8D2" />,
                  title: "Your exercise order",
                  detail: "Build, rearrange and refine.",
                },
                {
                  icon: <RefreshCw aria-hidden size={19} color="#DDE8D2" />,
                  title: "Ready for next time",
                  detail: "Reuse routines with previous weights.",
                },
              ].map((feature) => (
                <View
                  key={feature.title}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 13,
                    paddingVertical: 10,
                  }}
                >
                  <View
                    style={{
                      width: 45,
                      height: 45,
                      borderRadius: 14,
                      backgroundColor: "#354136",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    {feature.icon}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Txt
                      style={{
                        color: c.cream,
                        fontFamily: f.bold,
                        fontSize: 15,
                      }}
                    >
                      {feature.title}
                    </Txt>
                    <Txt style={{ color: "#C4D0BF", fontSize: 14 }}>
                      {feature.detail}
                    </Txt>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Card>
      </FadeIn>

      {!!notice && (
        <View
          accessibilityLiveRegion="polite"
          style={[
            u.between,
            { padding: 14, borderRadius: 16, backgroundColor: c.sage },
          ]}
        >
          <Txt style={{ flex: 1 }}>{notice}</Txt>
          <IconButton
            label="Dismiss message"
            onPress={() => setNotice("")}
            icon={<X aria-hidden size={16} color={c.ink} />}
            style={{ backgroundColor: "transparent", borderWidth: 0 }}
          />
        </View>
      )}

      <View style={[u.between, { flexWrap: "wrap" }]}>
        <View style={{ gap: 4, flex: 1 }}>
          <Txt
            accessibilityRole="header"
            style={{ fontFamily: f.display, fontSize: 21, lineHeight: 28 }}
          >
            Your routines <Txt muted>({routines.length})</Txt>
          </Txt>
          <Txt muted style={{ fontSize: 13 }}>
            {library.status}
          </Txt>
        </View>
        {!!auth && (
          <Button
            kind="ghost"
            onPress={() => void library.sync()}
            disabled={!library.ready}
            icon={<RefreshCw aria-hidden size={16} color={c.ink} />}
          >
            Sync
          </Button>
        )}
      </View>
      {!!library.error && (
        <Txt accessibilityRole="alert" style={{ color: c.danger }}>
          {library.error}
        </Txt>
      )}
      {!library.ready && !library.error && (
        <Txt muted>Opening your saved routines…</Txt>
      )}
      {library.ready && routines.length === 0 && (
        <Card
          style={{
            padding: width < 600 ? 24 : 32,
            alignItems: "center",
            gap: 17,
          }}
        >
          <View
            style={{
              width: 65,
              height: 65,
              borderRadius: 22,
              backgroundColor: c.sage,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Dumbbell aria-hidden size={28} color={c.green} strokeWidth={1.5} />
          </View>
          <Txt
            style={{
              fontFamily: f.display,
              fontSize: 22,
              lineHeight: 30,
              textAlign: "center",
            }}
          >
            A blank page. A better session.
          </Txt>
          <Txt
            muted
            style={{ maxWidth: 440, textAlign: "center", fontSize: 15 }}
          >
            Start with the movements you enjoy. Build from the exercise library,
            then make every detail your own.
          </Txt>
          <Button
            onPress={() => edit()}
            kind={pro ? "primary" : "light"}
            icon={<Plus aria-hidden size={17} color={pro ? "white" : c.ink} />}
          >
            {pro ? "Create my first routine" : "Explore FORMA Plus"}
          </Button>
        </Card>
      )}
      <View
        style={{
          flexDirection: width >= 1250 ? "row" : "column",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        {routines.map((routine) => {
          const workout = routineToWorkout(routine);
          const actual = estimateWorkoutMinutes(workout, state.profile);
          const totalSets = routine.exercises.reduce(
            (sum, exercise) => sum + exercise.sets,
            0,
          );
          return (
            <Card
              key={routine.id}
              style={{
                width: width >= 1250 ? "48.8%" : "100%",
                gap: 19,
                padding: 22,
              }}
            >
              <View style={[u.between, { alignItems: "flex-start" }]}>
                <View style={{ flex: 1, gap: 8 }}>
                  <Eyebrow style={{ color: c.green }}>MADE BY YOU</Eyebrow>
                  <Txt
                    accessibilityRole="header"
                    style={{
                      fontFamily: f.display,
                      fontSize: 22,
                      lineHeight: 29,
                    }}
                  >
                    {routine.name}
                  </Txt>
                </View>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 15,
                    backgroundColor: c.sage,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Dumbbell aria-hidden color={c.green} size={21} />
                </View>
              </View>
              <View style={{ gap: 7 }}>
                <View style={[u.row, { flexWrap: "wrap", gap: 12 }]}>
                  <Txt muted>{routine.exercises.length} exercises</Txt>
                  <Txt muted>{totalSets} sets</Txt>
                  <View style={[u.row, { gap: 5 }]}>
                    <Clock3 aria-hidden size={14} color={c.muted} />
                    <Txt muted>About {actual} min</Txt>
                  </View>
                </View>
                <Txt muted style={{ fontSize: 13 }}>
                  {routine.minutes} min budget
                  {actual > routine.minutes
                    ? " · allow extra time or edit your sets"
                    : ""}
                </Txt>
              </View>
              <Txt numberOfLines={2} style={{ fontSize: 14 }}>
                {routine.exercises
                  .map(
                    (prescription) =>
                      exercises.find(
                        (exercise) => exercise.id === prescription.exerciseId,
                      )?.name,
                  )
                  .join(" · ")}
              </Txt>
              <View style={u.divider} />
              <View style={[u.between, { flexWrap: "wrap" }]}>
                <Button
                  onPress={() =>
                    pro ? onStart({ ...workout, minutes: actual }) : onUpgrade()
                  }
                  icon={
                    pro ? (
                      <Play aria-hidden size={15} color="white" fill="white" />
                    ) : (
                      <LockKeyhole aria-hidden size={15} color="white" />
                    )
                  }
                >
                  {pro ? "Start routine" : "Unlock with Plus"}
                </Button>
                <View style={[u.row, { gap: 8 }]}>
                  <IconButton
                    label={"Edit " + routine.name}
                    onPress={() => edit(routine)}
                    icon={<Pencil aria-hidden size={17} color={c.ink} />}
                  />
                  <IconButton
                    label={"Duplicate " + routine.name}
                    onPress={() => void copy(routine)}
                    icon={<Copy aria-hidden size={17} color={c.ink} />}
                  />
                  <IconButton
                    label={"Delete " + routine.name}
                    onPress={() => setDeleting(routine)}
                    icon={<Trash2 aria-hidden size={17} color={c.muted} />}
                  />
                </View>
              </View>
            </Card>
          );
        })}
      </View>
      {!auth && (
        <Txt muted style={{ fontSize: 13 }}>
          Guest routines stay on this device. Account libraries are kept
          separately.
        </Txt>
      )}

      <Sheet
        visible={!!draft && !discard}
        onClose={closeEditor}
        title={
          original && JSON.parse(original).name
            ? "Edit your routine"
            : "Build your routine"
        }
        wide
      >
        {!!draft && (
          <>
            <View style={{ gap: 8 }}>
              <Txt style={{ fontFamily: f.bold, fontSize: 14 }}>
                Routine name
              </Txt>
              <TextInput
                accessibilityLabel="Routine name"
                value={draft.name}
                onChangeText={(name) =>
                  setDraft((previous) => previous && { ...previous, name })
                }
                onBlur={() => {
                  if (!draft.name.trim())
                    setEditorError("Give your routine a name.");
                  else setEditorError("");
                }}
                placeholder="e.g. My upper body day"
                placeholderTextColor={c.muted}
                maxLength={60}
                style={[u.input, { fontSize: 16 }]}
              />
            </View>
            <View style={{ gap: 10 }}>
              <Txt style={{ fontFamily: f.bold }}>Time budget</Txt>
              <View style={[u.row, { gap: 8 }]}>
                {([30, 45, 60] as const).map((minutes) => (
                  <Pressable
                    key={minutes}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: draft.minutes === minutes }}
                    aria-checked={draft.minutes === minutes}
                    onPress={() =>
                      setDraft(
                        (previous) => previous && { ...previous, minutes },
                      )
                    }
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 48,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 16,
                      backgroundColor:
                        draft.minutes === minutes ? c.dark : c.paper,
                      borderWidth: 1,
                      borderColor: draft.minutes === minutes ? c.dark : c.line,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Txt
                      style={{
                        fontFamily: f.bold,
                        color: draft.minutes === minutes ? "white" : c.ink,
                      }}
                    >
                      {minutes} min
                    </Txt>
                  </Pressable>
                ))}
              </View>
              <Txt muted style={{ fontSize: 13 }}>
                A planning target. Your chosen sets and rest determine the
                session estimate.
              </Txt>
            </View>
            <View style={[u.between, { flexWrap: "wrap" }]}>
              <View style={{ gap: 4 }}>
                <Txt style={{ fontFamily: f.display, fontSize: 19 }}>
                  Your sequence
                </Txt>
                <Txt muted>
                  {draft.exercises.length}/{MAX_ROUTINE_EXERCISES} exercises ·{" "}
                  {draft.exercises.reduce(
                    (sum, exercise) => sum + exercise.sets,
                    0,
                  )}{" "}
                  sets
                </Txt>
              </View>
              <Button
                kind="light"
                onPress={() => setPicker(!picker)}
                disabled={draft.exercises.length >= MAX_ROUTINE_EXERCISES}
                icon={
                  picker ? (
                    <X aria-hidden size={17} color={c.ink} />
                  ) : (
                    <Plus aria-hidden size={17} color={c.ink} />
                  )
                }
              >
                {picker ? "Close library" : "Add exercises"}
              </Button>
            </View>
            {draft.exercises.length === 0 && !picker && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose your first exercise"
                onPress={() => setPicker(true)}
                style={{
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: "#B9C2B1",
                  borderRadius: 20,
                  padding: 28,
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Plus aria-hidden size={25} color={c.green} />
                <Txt style={{ fontFamily: f.medium }}>
                  Choose your first exercise
                </Txt>
                <Txt muted style={{ textAlign: "center" }}>
                  Build in the order you want to train.
                </Txt>
              </Pressable>
            )}
            {draft.exercises.map((prescription, index) => {
              const exercise = exercises.find(
                (item) => item.id === prescription.exerciseId,
              )!;
              const open = expanded === prescription.exerciseId;
              return (
                <View
                  key={prescription.exerciseId}
                  style={{
                    padding: width < 450 ? 14 : 18,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: open ? "#ADBBA1" : c.line,
                    backgroundColor: c.paper,
                    gap: 13,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"Configure " + exercise.name}
                    accessibilityState={{ expanded: open }}
                    aria-expanded={open}
                    onPress={() =>
                      setExpanded(open ? null : prescription.exerciseId)
                    }
                    style={{
                      minHeight: 48,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 31,
                        height: 31,
                        borderRadius: 11,
                        backgroundColor: c.sage,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Txt style={{ fontFamily: f.bold, color: c.green }}>
                        {index + 1}
                      </Txt>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Txt style={{ fontFamily: f.bold, fontSize: 15 }}>
                        {exercise.name}
                      </Txt>
                      <Txt muted style={{ fontSize: 13 }}>
                        {prescription.sets} × {prescription.reps}
                        {exercise.reps.includes("sec")
                          ? " sec"
                          : " reps"} · {prescription.restSeconds}s rest
                      </Txt>
                    </View>
                    {open ? (
                      <ChevronUp aria-hidden size={19} color={c.muted} />
                    ) : (
                      <ChevronDown aria-hidden size={19} color={c.muted} />
                    )}
                  </Pressable>
                  {open && (
                    <View style={{ gap: 12 }}>
                      <View style={u.divider} />
                      <Stepper
                        label="Sets"
                        value={prescription.sets}
                        min={1}
                        max={8}
                        onChange={(sets) => updateExercise(index, { sets })}
                      />
                      <Stepper
                        label={
                          exercise.reps.includes("sec")
                            ? "Seconds per set"
                            : "Reps per set"
                        }
                        value={prescription.reps}
                        min={1}
                        max={50}
                        onChange={(reps) => updateExercise(index, { reps })}
                      />
                      <Stepper
                        label="Rest (seconds)"
                        value={prescription.restSeconds}
                        min={0}
                        max={300}
                        step={15}
                        onChange={(restSeconds) =>
                          updateExercise(index, { restSeconds })
                        }
                      />
                      <View style={u.divider} />
                      <View style={[u.between, { flexWrap: "wrap" }]}>
                        <View style={[u.row, { gap: 8 }]}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={"Move " + exercise.name + " up"}
                            accessibilityState={{ disabled: index === 0 }}
                            disabled={index === 0}
                            onPress={() =>
                              setDraft(
                                (previous) =>
                                  previous &&
                                  reorderRoutineExercise(
                                    previous,
                                    index,
                                    index - 1,
                                  ),
                              )
                            }
                            style={{
                              minHeight: 48,
                              minWidth: 48,
                              borderRadius: 14,
                              backgroundColor: c.bg,
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: index === 0 ? 0.3 : 1,
                            }}
                          >
                            <ArrowUp aria-hidden size={18} color={c.ink} />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={
                              "Move " + exercise.name + " down"
                            }
                            accessibilityState={{
                              disabled: index === draft.exercises.length - 1,
                            }}
                            disabled={index === draft.exercises.length - 1}
                            onPress={() =>
                              setDraft(
                                (previous) =>
                                  previous &&
                                  reorderRoutineExercise(
                                    previous,
                                    index,
                                    index + 1,
                                  ),
                              )
                            }
                            style={{
                              minHeight: 48,
                              minWidth: 48,
                              borderRadius: 14,
                              backgroundColor: c.bg,
                              alignItems: "center",
                              justifyContent: "center",
                              opacity:
                                index === draft.exercises.length - 1 ? 0.3 : 1,
                            }}
                          >
                            <ArrowDown aria-hidden size={18} color={c.ink} />
                          </Pressable>
                        </View>
                        <Button
                          kind="ghost"
                          onPress={() =>
                            setDraft(
                              (previous) =>
                                previous && {
                                  ...previous,
                                  exercises: previous.exercises.filter(
                                    (item) =>
                                      item.exerciseId !==
                                      prescription.exerciseId,
                                  ),
                                },
                            )
                          }
                          icon={<Trash2 aria-hidden size={16} color={c.ink} />}
                        >
                          Remove
                        </Button>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
            {picker && (
              <View
                style={{
                  borderRadius: 20,
                  padding: width < 450 ? 14 : 20,
                  backgroundColor: c.sage,
                  gap: 16,
                }}
              >
                <View style={u.between}>
                  <Txt
                    accessibilityRole="header"
                    style={{ fontFamily: f.display, fontSize: 19 }}
                  >
                    Exercise library
                  </Txt>
                  <Txt muted>{filtered.length} found</Txt>
                </View>
                <View
                  style={[
                    u.row,
                    {
                      backgroundColor: c.paper,
                      borderRadius: 15,
                      paddingHorizontal: 14,
                    },
                  ]}
                >
                  <Search aria-hidden size={19} color={c.muted} />
                  <TextInput
                    accessibilityLabel="Search Studio exercises"
                    placeholder="Search movement or muscle"
                    placeholderTextColor={c.muted}
                    value={query}
                    onChangeText={setQuery}
                    style={{
                      flex: 1,
                      minHeight: 50,
                      paddingVertical: 12,
                      fontFamily: f.regular,
                      fontSize: 15,
                      color: c.ink,
                    }}
                  />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {groups.map((group) => (
                    <Pressable
                      key={group}
                      accessibilityRole="button"
                      accessibilityState={{ selected: muscle === group }}
                      onPress={() => setMuscle(group)}
                      style={{
                        paddingHorizontal: 16,
                        minHeight: 48,
                        justifyContent: "center",
                        borderRadius: 22,
                        backgroundColor: muscle === group ? c.dark : c.paper,
                      }}
                    >
                      <Txt
                        style={{
                          color: muscle === group ? "white" : c.ink,
                          fontFamily: f.medium,
                        }}
                      >
                        {group}
                      </Txt>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: equipmentOnly }}
                  aria-checked={equipmentOnly}
                  onPress={() => setEquipmentOnly(!equipmentOnly)}
                  style={{
                    minHeight: 48,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 23,
                      height: 23,
                      borderRadius: 7,
                      borderWidth: 1,
                      borderColor: equipmentOnly ? c.green : c.muted,
                      backgroundColor: equipmentOnly ? c.green : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {equipmentOnly && (
                      <Check aria-hidden size={15} color="white" />
                    )}
                  </View>
                  <Txt style={{ flex: 1 }}>
                    Match my equipment · {state.profile.equipment}
                  </Txt>
                </Pressable>
                <ScrollView
                  nestedScrollEnabled
                  style={{ maxHeight: 340 }}
                  contentContainerStyle={{ gap: 8 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {filtered.map((exercise) => {
                    const selected = draft.exercises.some(
                      (item) => item.exerciseId === exercise.id,
                    );
                    const disabled =
                      !selected &&
                      draft.exercises.length >= MAX_ROUTINE_EXERCISES;
                    return (
                      <Pressable
                        key={exercise.id}
                        accessibilityRole="checkbox"
                        accessibilityLabel={exercise.name}
                        accessibilityState={{ checked: selected, disabled }}
                        aria-checked={selected}
                        disabled={disabled}
                        onPress={() => {
                          setDraft(
                            (previous) =>
                              previous && {
                                ...previous,
                                exercises: selected
                                  ? previous.exercises.filter(
                                      (item) => item.exerciseId !== exercise.id,
                                    )
                                  : [
                                      ...previous.exercises,
                                      exerciseForRoutine(exercise.id),
                                    ],
                              },
                          );
                          setEditorError("");
                          if (Platform.OS !== "web")
                            void Haptics.selectionAsync();
                        }}
                        style={({ pressed }) => ({
                          minHeight: 73,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          padding: 14,
                          borderRadius: 15,
                          backgroundColor: c.paper,
                          borderWidth: 1,
                          borderColor: selected ? c.green : "transparent",
                          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
                        })}
                      >
                        <View style={{ flex: 1, gap: 4 }}>
                          <Txt style={{ fontFamily: f.bold, fontSize: 14 }}>
                            {exercise.name}
                          </Txt>
                          <Txt muted style={{ fontSize: 13 }}>
                            {exercise.muscle} · {exercise.equipment}
                          </Txt>
                        </View>
                        {selected ? (
                          <Check aria-hidden size={20} color={c.green} />
                        ) : (
                          <Plus aria-hidden size={20} color={c.ink} />
                        )}
                      </Pressable>
                    );
                  })}
                  {filtered.length === 0 && (
                    <Txt style={{ padding: 16, textAlign: "center" }}>
                      No matches. Try another search or include all equipment.
                    </Txt>
                  )}
                </ScrollView>
                <Button
                  kind="dark"
                  onPress={() => setPicker(false)}
                  icon={<Check aria-hidden size={17} color="white" />}
                >
                  Done choosing · {draft.exercises.length} selected
                </Button>
              </View>
            )}
            {!!draft.exercises.length && (
              <View
                accessibilityLiveRegion="polite"
                style={{
                  padding: 18,
                  borderRadius: 18,
                  backgroundColor:
                    estimate > draft.minutes ? c.paleOrange : c.sage,
                  gap: 6,
                }}
              >
                <View style={[u.row, { gap: 8 }]}>
                  <Clock3
                    aria-hidden
                    size={18}
                    color={estimate > draft.minutes ? c.orangeDark : c.green}
                  />
                  <Txt style={{ fontFamily: f.bold }}>
                    About {estimate} minutes
                  </Txt>
                </View>
                <Txt style={{ fontSize: 14 }}>
                  {estimate > draft.minutes
                    ? "This runs over your " +
                      draft.minutes +
                      " minute budget. Reduce sets or exercises, or give yourself more time."
                    : "Your chosen movements, sets and rest fit within your " +
                      draft.minutes +
                      " minute budget."}
                </Txt>
              </View>
            )}
            {!!editorError && (
              <Txt accessibilityRole="alert" style={{ color: c.danger }}>
                {editorError}
              </Txt>
            )}
            <Button
              onPress={() => void saveEditor()}
              disabled={busy}
              icon={<Check aria-hidden size={18} color="white" />}
            >
              {busy ? "Saving routine…" : "Save my routine"}
            </Button>
            <Txt muted style={{ textAlign: "center", fontSize: 13 }}>
              {auth
                ? "Saved here first, then synced to your account."
                : "Saved on this device in your guest library."}
            </Txt>
          </>
        )}
      </Sheet>
      <Sheet
        visible={discard}
        onClose={() => setDiscard(false)}
        title="Discard unsaved changes?"
      >
        <Txt>
          Your saved routine stays as it was. The changes in this editor will be
          lost.
        </Txt>
        <Button kind="light" onPress={() => setDiscard(false)}>
          Keep editing
        </Button>
        <Button
          kind="ghost"
          onPress={() => {
            setDraft(null);
            setDiscard(false);
          }}
        >
          Discard changes
        </Button>
      </Sheet>
      <Sheet
        visible={!!deleting}
        onClose={() => !busy && setDeleting(null)}
        title="Delete this routine?"
      >
        <Txt>
          “{deleting?.name}” will be removed from your library. Completed
          workouts stay in your history.
        </Txt>
        {!!deleteError && (
          <Txt accessibilityRole="alert" style={{ color: c.danger }}>
            {deleteError}
          </Txt>
        )}
        <Button onPress={() => void remove()} disabled={busy}>
          {busy ? "Deleting…" : "Delete routine"}
        </Button>
        <Button kind="ghost" onPress={() => setDeleting(null)} disabled={busy}>
          Keep routine
        </Button>
      </Sheet>
    </View>
  );
}

export default Studio;
