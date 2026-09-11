import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState as NativeAppState,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Dumbbell,
  Info,
  Plus,
  Timer,
  Trash2,
} from "lucide-react-native";
import { exercises } from "../data";
import { compatibleExercise, prescriptionForExercise } from "../lib/training";
import { useStore } from "../store";
import { colors as c, fonts as f } from "../theme";
import type {
  ActiveWorkout,
  Exercise,
  LoggedSet,
  WorkoutRecord,
} from "../types";
import { Button, Eyebrow, Sheet, Title, Txt } from "./UI";

type Props = {
  onClose: () => void;
  onFinished: (record: WorkoutRecord) => void;
};
type Draft = { weight: string; reps: string };
type Rest = { deadline: number; total: number; exerciseId: string };
type Field = keyof Draft;
const setKey = (set: Pick<LoggedSet, "exerciseId" | "index">) =>
  `${set.exerciseId}:${set.index}`;
const restKey = (sessionId: string) => `forma-rest-v1:${sessionId}`;
const byId = (id: string) => exercises.find((exercise) => exercise.id === id);

function secondsLabel(value: number): string {
  const seconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
}

function parseField(text: string, field: Field): number | null {
  const value = text.trim();
  const validSyntax =
    field === "reps"
      ? /^\d+$/.test(value)
      : /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value);
  const number = Number(value.replace(",", "."));
  return validSyntax &&
    Number.isFinite(number) &&
    number <= 1000 &&
    number >= (field === "reps" ? 1 : 0) &&
    (field !== "reps" || Number.isInteger(number))
    ? number
    : null;
}

function fieldMessage(field: Field): string {
  return field === "reps"
    ? "Use 1–1,000 whole reps."
    : "Use a weight from 0–1,000.";
}

function convertWeight(
  weight: number,
  from: "kg" | "lb",
  to: "kg" | "lb",
): number {
  return (
    Math.round(
      weight * (from === to ? 1 : to === "kg" ? 0.45359237 : 2.20462262) * 10,
    ) / 10
  );
}

function vibrate(kind: "set" | "rest"): void {
  if (Platform.OS === "web") return;
  const effect =
    kind === "set"
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  void effect.catch(() => undefined);
}

function RestDial({ remaining, total }: { remaining: number; total: number }) {
  const circumference = 2 * Math.PI * 27;
  const progress = Math.max(0, Math.min(1, remaining / Math.max(1, total)));
  return (
    <View
      style={s.dial}
      aria-hidden={true}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg aria-hidden={true} width={64} height={64} viewBox="0 0 64 64">
        <Circle
          cx={32}
          cy={32}
          r={27}
          stroke={c.green}
          strokeWidth={3}
          fill="none"
        />
        <Circle
          cx={32}
          cy={32}
          r={27}
          stroke={c.cream}
          strokeWidth={3}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          rotation={-90}
          origin="32, 32"
        />
      </Svg>
      <View style={s.dialIcon}>
        <Timer aria-hidden={true} size={22} color={c.cream} strokeWidth={1.6} />
      </View>
    </View>
  );
}

export default function WorkoutSession({ onClose, onFinished }: Props) {
  const { state, updateActive, finishWorkout, discardWorkout } = useStore();
  const active = state.active;
  const activeRef = useRef(active);
  activeRef.current = active;
  const [layoutWidth, setLayoutWidth] = useState(375);
  const { fontScale } = useWindowDimensions();
  const wide = layoutWidth >= 820;
  const largeText = fontScale >= 1.35;
  const [selectedId, setSelectedId] = useState(
    () =>
      active?.exercises.find((id) =>
        active.sets.some((set) => set.exerciseId === id && !set.done),
      ) ||
      active?.exercises[0] ||
      "",
  );
  const [showInstructions, setShowInstructions] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const draftsRef = useRef(drafts);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState<Rest | null>(null);
  const restRef = useRef(rest);
  restRef.current = rest;
  const restTouched = useRef(false);
  const restWrites = useRef(Promise.resolve());
  const [confirm, setConfirm] = useState<"finish" | "discard" | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapId, setSwapId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const entrance = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduceMotion(value);
      })
      .catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      alive = false;
      listener.remove();
    };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const listener = NativeAppState.addEventListener("change", (status) => {
      if (status === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(tick);
      listener.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const sessionId = active?.id;
    if (!sessionId) return;
    const session = activeRef.current;
    if (session)
      setSelectedId(
        session.exercises.find((id) =>
          session.sets.some((set) => set.exerciseId === id && !set.done),
        ) || session.exercises[0],
      );
    draftsRef.current = {};
    setDrafts({});
    setFieldErrors({});
    restRef.current = null;
    setRest(null);
    restTouched.current = false;
    void AsyncStorage.getItem(restKey(sessionId))
      .then((raw) => {
        if (!alive || restTouched.current || !raw) return;
        const saved: unknown = JSON.parse(raw);
        if (
          saved &&
          typeof saved === "object" &&
          "deadline" in saved &&
          "total" in saved &&
          "exerciseId" in saved &&
          typeof saved.deadline === "number" &&
          Number.isFinite(saved.deadline) &&
          saved.deadline > Date.now() &&
          typeof saved.total === "number" &&
          Number.isFinite(saved.total) &&
          saved.total > 0 &&
          typeof saved.exerciseId === "string" &&
          activeRef.current?.exercises.includes(saved.exerciseId)
        ) {
          const next = saved as Rest;
          restRef.current = next;
          setRest(next);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [active?.id]);

  useEffect(() => {
    entrance.stopAnimation();
    if (reduceMotion) {
      entrance.setValue(1);
      return;
    }
    entrance.setValue(0);
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: 230,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [selectedId, reduceMotion, entrance]);

  const completed = active?.sets.filter((set) => set.done).length || 0;
  const total = active?.sets.length || 0;
  const remaining = rest
    ? Math.max(0, Math.ceil((rest.deadline - now) / 1000))
    : 0;
  const currentExercise = byId(selectedId);
  const previous = useMemo(() => {
    const result = new Map<string, WorkoutRecord>();
    [...state.history]
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
      .forEach((record) => {
        record.sets.forEach((set) => {
          if (set.done && !result.has(set.exerciseId))
            result.set(set.exerciseId, record);
        });
      });
    return result;
  }, [state.history]);
  const alternatives = useMemo(
    () =>
      exercises.filter(
        (exercise) =>
          exercise.muscle === currentExercise?.muscle &&
          !active?.exercises.includes(exercise.id) &&
          compatibleExercise(exercise, state.profile),
      ),
    [currentExercise?.muscle, active?.exercises, state.profile],
  );

  function saveRest(next: Rest | null): void {
    restTouched.current = true;
    restRef.current = next;
    setRest(next);
    setNow(Date.now());
    const sessionId = activeRef.current?.id;
    if (!sessionId) return;
    restWrites.current = restWrites.current
      .catch(() => undefined)
      .then(() =>
        next
          ? AsyncStorage.setItem(restKey(sessionId), JSON.stringify(next))
          : AsyncStorage.removeItem(restKey(sessionId)),
      )
      .catch(() => {
        setNotice(
          "Your sets are saved separately. This rest timer may reset if you close the app.",
        );
      });
  }

  useEffect(() => {
    if (rest && rest.deadline <= now) {
      saveRest(null);
      setNotice("Rest complete. Ready when you are.");
      vibrate("rest");
    }
  }, [now, rest]);

  function commit(next: ActiveWorkout): void {
    activeRef.current = next;
    updateActive(next);
  }

  function draftFor(set: LoggedSet): Draft {
    return (
      draftsRef.current[setKey(set)] || {
        weight: String(set.weight),
        reps: String(set.reps),
      }
    );
  }

  function editField(set: LoggedSet, field: Field, text: string): void {
    const key = setKey(set);
    const next = { ...draftFor(set), [field]: text };
    draftsRef.current = { ...draftsRef.current, [key]: next };
    setDrafts(draftsRef.current);
    const number = parseField(text, field);
    setFieldErrors((errors) => {
      if (!errors[`${key}:${field}`]) return errors;
      return {
        ...errors,
        [`${key}:${field}`]: number === null ? fieldMessage(field) : "",
      };
    });
    const current = activeRef.current;
    if (current)
      commit({
        ...current,
        sets: current.sets.map((item) =>
          setKey(item) === key
            ? number === null
              ? { ...item, done: false }
              : { ...item, [field]: number }
            : item,
        ),
      });
    setError("");
  }

  function validateSet(set: LoggedSet): boolean {
    const draft = draftFor(set);
    const key = setKey(set);
    const weightError =
      parseField(draft.weight, "weight") === null ? fieldMessage("weight") : "";
    const repsError =
      parseField(draft.reps, "reps") === null ? fieldMessage("reps") : "";
    setFieldErrors((errors) => ({
      ...errors,
      [`${key}:weight`]: weightError,
      [`${key}:reps`]: repsError,
    }));
    return !weightError && !repsError;
  }

  function validateAll(): boolean {
    const current = activeRef.current;
    if (!current) return false;
    let firstInvalid: string | null = null;
    current.sets.forEach((set) => {
      if (!validateSet(set) && !firstInvalid) firstInvalid = set.exerciseId;
    });
    if (firstInvalid) {
      setSelectedId(firstInvalid);
      setError(
        "Check the highlighted weight or reps. Your typed entries are still here.",
      );
      return false;
    }
    return true;
  }

  function toggleSet(set: LoggedSet): void {
    const current = activeRef.current;
    if (!current || !validateSet(set)) return;
    const key = setKey(set);
    const draft = draftFor(set);
    const nextSets = current.sets.map((item) =>
      setKey(item) === key
        ? {
            ...item,
            weight: parseField(draft.weight, "weight")!,
            reps: parseField(draft.reps, "reps")!,
            done: !item.done,
          }
        : item,
    );
    commit({ ...current, sets: nextSets });
    setError("");
    const justCompleted = nextSets.find((item) => setKey(item) === key)?.done;
    if (justCompleted) {
      vibrate("set");
      const exercise = byId(set.exerciseId);
      setNotice("");
      if (exercise && nextSets.some((item) => !item.done)) {
        const restSeconds =
          current.prescription?.find(
            (target) => target.exerciseId === exercise.id,
          )?.restSeconds ?? exercise.rest;
        saveRest({
          deadline: Date.now() + restSeconds * 1000,
          total: restSeconds,
          exerciseId: exercise.id,
        });
      } else {
        saveRest(null);
        setNotice("Every set is in. Take a moment to enjoy that.");
      }
    }
  }

  function selectExercise(id: string): void {
    setSelectedId(id);
    setShowInstructions(false);
    setError("");
  }

  function nextExercise(): void {
    const current = activeRef.current;
    if (!current) return;
    const position = current.exercises.indexOf(selectedId);
    const ordered = [
      ...current.exercises.slice(position + 1),
      ...current.exercises.slice(0, position),
    ];
    const next =
      ordered.find((id) =>
        current.sets.some((set) => set.exerciseId === id && !set.done),
      ) || ordered[0];
    if (next) {
      selectExercise(next);
      if (!wide) scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
    }
  }

  function requestFinish(): void {
    if (!validateAll()) return;
    const current = activeRef.current;
    const count = current?.sets.filter((set) => set.done).length || 0;
    if (!count) {
      setError("Complete at least one set before saving your workout.");
      return;
    }
    if (count < (current?.sets.length || 0)) setConfirm("finish");
    else finish();
  }

  function finish(): void {
    if (finishingRef.current || !validateAll()) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      const record = finishWorkout();
      if (!record)
        throw new Error(
          "Complete at least one set before saving your workout.",
        );
      saveRest(null);
      setConfirm(null);
      onFinished(record);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Your workout could not be finished. Please try again.",
      );
      setConfirm(null);
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
  }

  function applySwap(): void {
    const current = activeRef.current;
    const replacement = alternatives.find((exercise) => exercise.id === swapId);
    if (!current || !replacement || !current.exercises.includes(selectedId))
      return;
    const oldId = selectedId;
    const last = previous.get(replacement.id);
    const replacementTarget = prescriptionForExercise(
      replacement,
      state.profile,
    );
    const count = replacementTarget.sets;
    const newSets: LoggedSet[] = Array.from({ length: count }, (_, index) => {
      const old = last?.sets.find(
        (set) =>
          set.exerciseId === replacement.id && set.index === index && set.done,
      );
      return {
        exerciseId: replacement.id,
        index,
        done: false,
        weight: old
          ? Math.min(
              1000,
              Math.max(0, convertWeight(old.weight, last!.unit, current.unit)),
            )
          : 0,
        reps: old
          ? Math.min(1000, Math.max(1, Math.round(old.reps)))
          : replacementTarget.reps,
      };
    });
    const ids = current.exercises.map((id) =>
      id === oldId ? replacement.id : id,
    );
    commit({
      ...current,
      exercises: ids,
      prescription: ids.map((id) =>
        id === replacement.id
          ? replacementTarget
          : (current.prescription?.find((target) => target.exerciseId === id) ??
            prescriptionForExercise(byId(id)!, state.profile)),
      ),
      sets: ids.flatMap((id) =>
        id === replacement.id
          ? newSets
          : current.sets.filter((set) => set.exerciseId === id),
      ),
    });
    draftsRef.current = Object.fromEntries(
      Object.entries(draftsRef.current).filter(
        ([key]) => !key.startsWith(`${oldId}:`),
      ),
    );
    setDrafts(draftsRef.current);
    setFieldErrors((errors) =>
      Object.fromEntries(
        Object.entries(errors).filter(([key]) => !key.startsWith(`${oldId}:`)),
      ),
    );
    if (restRef.current?.exerciseId === oldId) saveRest(null);
    selectExercise(replacement.id);
    setSwapOpen(false);
    setSwapId(null);
    setNotice(`${replacement.name} added to this session.`);
  }

  function previousLabel(set: LoggedSet): string {
    if (!active) return "—";
    const record = previous.get(set.exerciseId);
    const old = record?.sets.find(
      (item) =>
        item.exerciseId === set.exerciseId &&
        item.index === set.index &&
        item.done,
    );
    if (!old || !record) return "—";
    const weight = convertWeight(old.weight, record.unit, active.unit);
    return `${weight} ${active.unit} × ${old.reps}`;
  }

  function renderExercisePanel(exercise: Exercise) {
    if (!active) return null;
    const sets = active.sets.filter((set) => set.exerciseId === exercise.id);
    const allDone = sets.length > 0 && sets.every((set) => set.done);
    return (
      <Animated.View
        style={[
          s.exercisePanel,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [7, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={s.exercisePanelTop}>
          <View style={s.exerciseBadge}>
            <Dumbbell
              aria-hidden={true}
              size={25}
              strokeWidth={1.5}
              color={c.green}
            />
          </View>
          <View style={s.flex}>
            <Eyebrow style={{ color: c.green }}>
              {exercise.muscle} · {exercise.equipment}
            </Eyebrow>
            <Txt accessibilityRole="header" style={s.exerciseTitle}>
              {exercise.name}
            </Txt>
          </View>
        </View>
        <View style={s.exerciseMeta}>
          <Txt style={s.metaText}>
            {active.prescription?.find(
              (target) => target.exerciseId === exercise.id,
            )?.reps ?? exercise.reps}{" "}
            reps / set
          </Txt>
          <View style={s.metaDot} />
          <Txt style={s.metaText}>
            {secondsLabel(
              active.prescription?.find(
                (target) => target.exerciseId === exercise.id,
              )?.restSeconds ?? exercise.rest,
            )}{" "}
            rest
          </Txt>
        </View>
        <View style={s.guidanceRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showInstructions }}
            onPress={() => setShowInstructions((value) => !value)}
            style={({ pressed }) => [s.textAction, pressed && s.pressed]}
          >
            <Info aria-hidden={true} size={16} color={c.green} />
            <Txt style={s.textActionLabel}>Movement guide</Txt>
            {showInstructions ? (
              <ChevronUp aria-hidden={true} size={15} color={c.green} />
            ) : (
              <ChevronDown aria-hidden={true} size={15} color={c.green} />
            )}
          </Pressable>
          {alternatives.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Swap ${exercise.name}`}
              onPress={() => {
                setSwapId(null);
                setSwapOpen(true);
              }}
              style={({ pressed }) => [s.textAction, pressed && s.pressed]}
            >
              <ArrowRightLeft aria-hidden={true} size={15} color={c.muted} />
              <Txt style={s.swapLabel}>Swap</Txt>
            </Pressable>
          )}
        </View>
        {showInstructions && (
          <View style={s.guide}>
            {exercise.instructions.map((instruction, index) => (
              <View key={instruction} style={s.instructionRow}>
                <Txt style={s.instructionNumber}>
                  {String(index + 1).padStart(2, "0")}
                </Txt>
                <Txt style={s.instruction}>{instruction}</Txt>
              </View>
            ))}
            <Txt style={s.tip}>{exercise.tip}</Txt>
          </View>
        )}
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Txt style={[s.tableHeading, s.setColumn]}>SET</Txt>
            {!largeText && (
              <Txt style={[s.tableHeading, s.previousColumn]}>PREVIOUS</Txt>
            )}
            <Txt style={[s.tableHeading, s.valueColumn]}>
              {active.unit.toUpperCase()}
            </Txt>
            <Txt style={[s.tableHeading, s.valueColumn]}>REPS</Txt>
            <View style={s.checkColumn}>
              <Check aria-hidden={true} size={15} color={c.muted} />
            </View>
          </View>
          {sets.map((set) => {
            const key = setKey(set);
            const draft = draftFor(set);
            const weightError = fieldErrors[`${key}:weight`];
            const repsError = fieldErrors[`${key}:reps`];
            return (
              <View key={key} style={s.setBlock}>
                <View style={[s.setRow, set.done && s.setRowDone]}>
                  <Txt style={[s.setNumber, s.setColumn]}>{set.index + 1}</Txt>
                  {!largeText && (
                    <Txt style={[s.previousValue, s.previousColumn]}>
                      {previousLabel(set)}
                    </Txt>
                  )}
                  <View style={s.valueColumn}>
                    <TextInput
                      value={draft.weight}
                      onChangeText={(text) => editField(set, "weight", text)}
                      onBlur={() => validateSet(set)}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      selectTextOnFocus
                      accessibilityLabel={`${exercise.name}, set ${set.index + 1}, weight in ${active.unit}`}
                      accessibilityHint={
                        weightError || "Enter 0 for bodyweight. Maximum 1,000."
                      }
                      style={[
                        s.setInput,
                        set.done && s.setInputDone,
                        !!weightError && s.invalidInput,
                      ]}
                    />
                  </View>
                  <View style={s.valueColumn}>
                    <TextInput
                      value={draft.reps}
                      onChangeText={(text) => editField(set, "reps", text)}
                      onBlur={() => validateSet(set)}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      selectTextOnFocus
                      accessibilityLabel={`${exercise.name}, set ${set.index + 1}, reps`}
                      accessibilityHint={
                        repsError || "Enter a whole number from 1 to 1,000."
                      }
                      style={[
                        s.setInput,
                        set.done && s.setInputDone,
                        !!repsError && s.invalidInput,
                      ]}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: set.done }}
                    accessibilityLabel={`${set.done ? "Unmark" : "Complete"} ${exercise.name}, set ${set.index + 1}`}
                    onPress={() => toggleSet(set)}
                    style={({ pressed }) => [
                      s.setCheck,
                      set.done && s.setCheckDone,
                      pressed && s.pressed,
                    ]}
                  >
                    <Check
                      aria-hidden={true}
                      size={20}
                      strokeWidth={set.done ? 2.6 : 1.7}
                      color={set.done ? c.paper : c.muted}
                    />
                  </Pressable>
                </View>
                {largeText && (
                  <Txt style={s.tableHint}>Previous: {previousLabel(set)}</Txt>
                )}
                {(!!weightError || !!repsError) && (
                  <Txt accessibilityLiveRegion="polite" style={s.fieldError}>
                    Set {set.index + 1}:{" "}
                    {[weightError, repsError].filter(Boolean).join(" ")}
                  </Txt>
                )}
              </View>
            );
          })}
        </View>
        <Txt style={s.tableHint}>
          Use 0 {active.unit} for bodyweight. Tap the check after each set.
        </Txt>
        {allDone && (
          <View style={s.exerciseDone}>
            <CheckCircle2 aria-hidden={true} size={18} color={c.green} />
            <Txt style={s.exerciseDoneText}>
              Exercise complete. Nicely done.
            </Txt>
          </View>
        )}
        {active.exercises.length > 1 && (
          <Button
            kind="light"
            onPress={nextExercise}
            icon={<ArrowRight aria-hidden={true} size={17} color={c.ink} />}
            style={{ marginTop: 18 }}
          >
            Next exercise
          </Button>
        )}
      </Animated.View>
    );
  }

  if (!active)
    return (
      <View style={s.empty}>
        <CheckCircle2 aria-hidden={true} size={36} color={c.green} />
        <Title>No workout in progress</Title>
        <Txt muted>Choose a session when you’re ready to move.</Txt>
        <Button onPress={onClose}>Back to your day</Button>
      </View>
    );

  const elapsed = Math.max(
    0,
    Math.floor((now - Date.parse(active.startedAt)) / 1000),
  );
  const selectedLogged = active.sets.filter(
    (set) => set.exerciseId === selectedId && set.done,
  ).length;
  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.scrollContent, wide && s.scrollContentWide]}
      >
        <View style={s.topRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (validateAll()) onClose();
            }}
            style={({ pressed }) => [s.backAction, pressed && s.pressed]}
          >
            <ArrowLeft aria-hidden={true} size={19} color={c.ink} />
            <Txt style={s.backLabel}>Save & exit</Txt>
          </Pressable>
          <View style={s.liveLabel}>
            <View style={s.liveDot} />
            <Eyebrow style={{ color: c.green, letterSpacing: 1.5 }}>
              In your element
            </Eyebrow>
          </View>
        </View>
        <View
          style={[
            s.header,
            largeText && layoutWidth < 600 && { flexDirection: "column" },
          ]}
        >
          <View style={s.flex}>
            <Eyebrow style={{ color: c.muted }}>Your session</Eyebrow>
            <Title style={s.sessionTitle}>{active.name}</Title>
          </View>
          <View
            style={s.elapsedBadge}
            accessibilityLabel={`Elapsed time ${secondsLabel(elapsed)}`}
          >
            <Clock3 aria-hidden={true} size={17} color={c.green} />
            <Txt style={s.elapsedText}>{secondsLabel(elapsed)}</Txt>
          </View>
        </View>
        <View style={s.progressLabel}>
          <Txt style={s.progressText}>
            {completed} <Txt style={s.progressOf}>/ {total} sets complete</Txt>
          </Txt>
          <Txt style={s.progressPercent}>
            {total ? Math.round((completed / total) * 100) : 0}%
          </Txt>
        </View>
        <View
          style={s.progressTrack}
          accessibilityRole="progressbar"
          accessibilityLabel="Completed workout sets"
          accessibilityValue={{ min: 0, max: total, now: completed }}
        >
          <View
            style={[
              s.progressFill,
              { width: `${total ? (completed / total) * 100 : 0}%` },
            ]}
          />
        </View>
        {!!error && (
          <View style={s.errorBox}>
            <Txt accessibilityRole="alert" style={s.errorText}>
              {error}
            </Txt>
          </View>
        )}
        {!!notice && (
          <Txt accessibilityLiveRegion="polite" style={s.notice}>
            {notice}
          </Txt>
        )}
        <View style={[s.workArea, wide && s.workAreaWide]}>
          <View style={[s.exerciseList, wide && s.exerciseListWide]}>
            <Eyebrow style={s.sectionEyebrow}>One movement at a time</Eyebrow>
            {active.exercises.map((id, index) => {
              const exercise = byId(id);
              if (!exercise) return null;
              const sets = active.sets.filter((set) => set.exerciseId === id);
              const count = sets.filter((set) => set.done).length;
              const done = sets.length > 0 && count === sets.length;
              const selected = id === selectedId;
              return (
                <View
                  key={id}
                  style={[s.exerciseItem, selected && s.exerciseItemSelected]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                      selected,
                      expanded: !wide && selected,
                    }}
                    accessibilityLabel={`${exercise.name}, ${count} of ${sets.length} sets complete`}
                    onPress={() => selectExercise(id)}
                    style={({ pressed }) => [
                      s.exerciseNav,
                      pressed && s.pressed,
                    ]}
                  >
                    <View
                      style={[
                        s.exerciseIndex,
                        selected && s.exerciseIndexSelected,
                        done && s.exerciseIndexDone,
                      ]}
                    >
                      {done ? (
                        <Check
                          aria-hidden={true}
                          size={18}
                          color={c.paper}
                          strokeWidth={2.5}
                        />
                      ) : (
                        <Txt
                          style={[
                            s.exerciseIndexText,
                            selected && { color: c.paper },
                          ]}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </Txt>
                      )}
                    </View>
                    <View style={s.flex}>
                      <Txt style={s.exerciseNavName}>{exercise.name}</Txt>
                      <Txt style={s.exerciseNavMeta}>
                        {exercise.muscle} · {count}/{sets.length} sets
                      </Txt>
                    </View>
                    {!wide &&
                      (selected ? (
                        <ChevronUp
                          aria-hidden={true}
                          size={17}
                          color={c.muted}
                        />
                      ) : (
                        <ChevronDown
                          aria-hidden={true}
                          size={17}
                          color={c.muted}
                        />
                      ))}
                    {wide && selected && (
                      <ArrowRight
                        aria-hidden={true}
                        size={17}
                        color={c.orangeDark}
                      />
                    )}
                  </Pressable>
                  {!wide && selected && renderExercisePanel(exercise)}
                </View>
              );
            })}
            <View style={s.sessionNote}>
              <View style={s.noteLine} />
              <Txt style={s.sessionNoteText}>
                A little stronger than yesterday.
              </Txt>
            </View>
          </View>
          {wide && currentExercise && (
            <View style={s.desktopPanel}>
              {renderExercisePanel(currentExercise)}
            </View>
          )}
        </View>
        <View style={s.finishArea}>
          <View style={s.finishCopy}>
            <Txt style={s.finishTitle}>
              {completed === total && total > 0
                ? "That’s your session."
                : "Progress, at your pace."}
            </Txt>
            <Txt style={s.finishDescription}>
              {completed
                ? "Your completed sets will be saved to your history."
                : "Log your first set to begin building your history."}
            </Txt>
          </View>
          <Button
            onPress={requestFinish}
            disabled={finishing || completed === 0}
            kind="dark"
            style={s.finishButton}
            icon={<Check aria-hidden={true} size={18} color={c.paper} />}
          >
            {finishing ? "Saving workout…" : "Finish workout"}
          </Button>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setConfirm("discard")}
          style={({ pressed }) => [s.discardAction, pressed && s.pressed]}
        >
          <Trash2 aria-hidden={true} size={15} color={c.muted} />
          <Txt style={s.discardLabel}>Discard this session</Txt>
        </Pressable>
      </ScrollView>
      {rest && (
        <View style={[s.restDock, layoutWidth >= 600 && s.restDockWide]}>
          <View style={s.restMain}>
            <RestDial remaining={remaining} total={rest.total} />
            <View style={s.flex}>
              <Txt style={s.restEyebrow}>TAKE A BREATH</Txt>
              <Txt
                accessibilityLabel={`${remaining} seconds of rest remaining`}
                style={s.restTime}
              >
                {secondsLabel(remaining)}{" "}
                <Txt style={s.restTimeCaption}>rest remaining</Txt>
              </Txt>
            </View>
          </View>
          <View style={s.restActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add 15 seconds of rest"
              onPress={() => {
                const current = restRef.current;
                if (current)
                  saveRest({
                    ...current,
                    deadline: Math.max(Date.now(), current.deadline) + 15000,
                    total: current.total + 15,
                  });
              }}
              style={({ pressed }) => [s.extendButton, pressed && s.pressed]}
            >
              <Plus aria-hidden={true} size={16} color={c.cream} />
              <Txt style={s.extendText}>15 sec</Txt>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                saveRest(null);
                setNotice("Rest skipped. Continue when you’re ready.");
              }}
              style={({ pressed }) => [s.skipButton, pressed && s.pressed]}
            >
              <Txt style={s.skipText}>Skip rest</Txt>
              <ArrowRight aria-hidden={true} size={16} color={c.dark} />
            </Pressable>
          </View>
        </View>
      )}
      <Sheet
        visible={confirm === "finish"}
        onClose={() => setConfirm(null)}
        title="Finish here?"
      >
        <View style={s.confirmIcon}>
          <CheckCircle2 aria-hidden={true} size={28} color={c.green} />
        </View>
        <Txt style={s.confirmText}>
          You’ve completed {completed} of {total} sets. Save this session with
          the work you’ve done, or keep going.
        </Txt>
        <Button onPress={finish} disabled={finishing} kind="dark">
          {finishing ? "Saving…" : "Save partial workout"}
        </Button>
        <Button onPress={() => setConfirm(null)} kind="ghost">
          Keep training
        </Button>
      </Sheet>
      <Sheet
        visible={confirm === "discard"}
        onClose={() => setConfirm(null)}
        title="Discard this session?"
      >
        <Txt style={s.confirmText}>
          This removes the current session and its {completed} completed{" "}
          {completed === 1 ? "set" : "sets"}. It won’t be added to your history.
        </Txt>
        <Button
          onPress={() => {
            saveRest(null);
            discardWorkout();
            setConfirm(null);
            onClose();
          }}
          style={{ backgroundColor: c.danger }}
        >
          Discard session
        </Button>
        <Button onPress={() => setConfirm(null)} kind="light">
          Keep my session
        </Button>
      </Sheet>
      <Sheet
        visible={swapOpen}
        onClose={() => {
          setSwapOpen(false);
          setSwapId(null);
        }}
        title="A different way to move"
      >
        <Txt muted>
          Alternatives for {currentExercise?.muscle.toLowerCase()} using your
          available equipment. Choose one to replace{" "}
          {currentExercise?.name.toLowerCase()}.
        </Txt>
        <View style={{ gap: 10 }}>
          {alternatives.map((exercise) => (
            <Pressable
              key={exercise.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: swapId === exercise.id }}
              onPress={() => setSwapId(exercise.id)}
              style={({ pressed }) => [
                s.swapOption,
                swapId === exercise.id && s.swapOptionSelected,
                pressed && s.pressed,
              ]}
            >
              <View style={s.flex}>
                <Txt style={s.swapName}>{exercise.name}</Txt>
                <Txt style={s.swapDetail}>
                  {exercise.equipment} · {exercise.reps} reps
                </Txt>
              </View>
              <View
                style={[
                  s.swapRadio,
                  swapId === exercise.id && s.swapRadioSelected,
                ]}
              >
                {swapId === exercise.id && (
                  <Check aria-hidden={true} size={15} color={c.paper} />
                )}
              </View>
            </Pressable>
          ))}
        </View>
        <Txt style={s.swapWarning}>
          {selectedLogged
            ? `This replaces ${selectedLogged} completed ${selectedLogged === 1 ? "set" : "sets"} and all other entries for this exercise.`
            : "Existing entries for this exercise will be replaced."}
        </Txt>
        <Button disabled={!swapId} onPress={applySwap} kind="dark">
          Swap exercise
        </Button>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  scrollContent: { padding: 20, paddingBottom: 28 },
  scrollContentWide: { padding: 32, paddingBottom: 28 },
  flex: { flex: 1, minWidth: 0 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  backAction: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  backLabel: { fontFamily: f.bold, fontSize: 12 },
  liveLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 1,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.green },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 24,
  },
  sessionTitle: {
    fontSize: 29,
    lineHeight: 37,
    letterSpacing: -1,
    marginTop: 6,
  },
  elapsedBadge: {
    paddingHorizontal: 12,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: c.sage,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 24,
  },
  elapsedText: {
    fontFamily: f.bold,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    color: c.green,
  },
  progressLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressText: { fontFamily: f.bold, fontSize: 14 },
  progressOf: { fontFamily: f.regular, fontSize: 12, color: c.muted },
  progressPercent: { fontFamily: f.bold, fontSize: 12, color: c.green },
  progressTrack: {
    height: 5,
    backgroundColor: c.line,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 28,
  },
  progressFill: { height: 5, backgroundColor: c.green, borderRadius: 3 },
  workArea: { gap: 24 },
  workAreaWide: { flexDirection: "row", alignItems: "flex-start" },
  exerciseList: { gap: 10 },
  exerciseListWide: { width: 268, flexShrink: 0 },
  sectionEyebrow: { color: c.muted, marginBottom: 4 },
  exerciseItem: {
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: c.paper,
  },
  exerciseItemSelected: { borderColor: c.green },
  exerciseNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    minHeight: 82,
  },
  exerciseIndex: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: c.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseIndexSelected: { backgroundColor: c.orangeDark },
  exerciseIndexDone: { backgroundColor: c.green },
  exerciseIndexText: { fontFamily: f.bold, fontSize: 11, color: c.muted },
  exerciseNavName: { fontFamily: f.bold, fontSize: 13, lineHeight: 19 },
  exerciseNavMeta: {
    color: c.muted,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 3,
  },
  desktopPanel: {
    flex: 1,
    minWidth: 0,
    backgroundColor: c.paper,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 22,
    overflow: "hidden",
    marginTop: 30,
  },
  exercisePanel: { padding: 16, paddingTop: 22 },
  exercisePanelTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  exerciseBadge: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: c.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseTitle: {
    fontFamily: f.heavy,
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: -0.7,
    marginTop: 5,
  },
  exerciseMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 18,
    flexWrap: "wrap",
  },
  metaText: { fontSize: 12, color: c.muted, lineHeight: 20 },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: c.muted },
  guidanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 5,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  textAction: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  textActionLabel: { fontFamily: f.bold, fontSize: 12, color: c.green },
  swapLabel: { fontSize: 12, color: c.muted },
  guide: {
    padding: 16,
    backgroundColor: c.bg,
    borderRadius: 13,
    gap: 14,
    marginBottom: 20,
  },
  instructionRow: { flexDirection: "row", gap: 11 },
  instructionNumber: {
    fontFamily: f.bold,
    fontSize: 11,
    color: c.green,
    lineHeight: 21,
  },
  instruction: { flex: 1, fontSize: 13, lineHeight: 21 },
  tip: {
    color: c.green,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: f.medium,
    borderTopWidth: 1,
    borderTopColor: c.line,
    paddingTop: 12,
  },
  table: { marginTop: 2, gap: 5 },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  tableHeading: {
    fontFamily: f.bold,
    fontSize: 9,
    letterSpacing: 0.7,
    color: c.muted,
    textAlign: "center",
    lineHeight: 15,
  },
  setColumn: { width: 23, textAlign: "center" },
  previousColumn: { flex: 1.2, minWidth: 0, textAlign: "center" },
  valueColumn: { flex: 1, minWidth: 0 },
  checkColumn: { width: 48, alignItems: "center" },
  setBlock: { gap: 4 },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    borderRadius: 10,
  },
  setRowDone: { backgroundColor: c.sage },
  setNumber: { fontFamily: f.bold, fontSize: 13 },
  previousValue: {
    fontSize: 10,
    color: c.muted,
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
  },
  setInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.muted,
    backgroundColor: c.bg,
    borderRadius: 9,
    paddingHorizontal: 3,
    paddingVertical: 11,
    fontFamily: f.bold,
    fontSize: 15,
    color: c.ink,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  setInputDone: { backgroundColor: c.paper },
  invalidInput: { borderColor: c.danger, backgroundColor: c.paleOrange },
  setCheck: {
    width: 48,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  setCheckDone: { backgroundColor: c.green, borderColor: c.green },
  fieldError: {
    color: c.danger,
    fontSize: 11,
    lineHeight: 18,
    paddingBottom: 5,
  },
  tableHint: { color: c.muted, fontSize: 11, lineHeight: 18, marginTop: 16 },
  exerciseDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },
  exerciseDoneText: {
    color: c.green,
    fontSize: 12,
    fontFamily: f.bold,
    flexShrink: 1,
  },
  sessionNote: { paddingVertical: 18, alignItems: "center", gap: 10 },
  noteLine: { width: 28, height: 2, backgroundColor: c.line },
  sessionNoteText: { fontSize: 11, color: c.muted },
  finishArea: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: c.line,
    gap: 18,
  },
  finishCopy: { gap: 5 },
  finishTitle: {
    fontFamily: f.display,
    fontSize: 21,
    lineHeight: 29,
    letterSpacing: -0.5,
  },
  finishDescription: { color: c.muted, fontSize: 12, lineHeight: 20 },
  finishButton: { minHeight: 54 },
  discardAction: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    marginTop: 15,
    paddingHorizontal: 16,
  },
  discardLabel: { fontSize: 11, color: c.muted },
  restDock: {
    backgroundColor: c.dark,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  restDockWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingBottom: 16,
  },
  restMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexShrink: 1,
  },
  dial: { width: 64, height: 64 },
  dialIcon: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  restEyebrow: {
    fontFamily: f.bold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: c.cream,
    lineHeight: 16,
  },
  restTime: {
    fontFamily: f.heavy,
    fontSize: 30,
    lineHeight: 38,
    fontVariant: ["tabular-nums"],
    color: c.paper,
  },
  restTimeCaption: { fontFamily: f.regular, fontSize: 11, color: c.cream },
  restActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  extendButton: {
    minHeight: 48,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.cream,
  },
  extendText: { fontFamily: f.bold, fontSize: 12, color: c.cream },
  skipButton: {
    minHeight: 48,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 24,
    backgroundColor: c.cream,
  },
  skipText: { fontFamily: f.bold, fontSize: 12, color: c.dark },
  errorBox: {
    borderWidth: 1,
    borderColor: c.danger,
    backgroundColor: c.paleOrange,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  errorText: { color: c.danger, fontSize: 13, lineHeight: 20 },
  notice: { fontSize: 12, lineHeight: 19, color: c.green, marginBottom: 18 },
  confirmIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: c.sage,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmText: { fontSize: 15, lineHeight: 24 },
  swapOption: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.paper,
    padding: 17,
  },
  swapOptionSelected: { borderColor: c.green, backgroundColor: c.sage },
  swapName: { fontFamily: f.bold, fontSize: 14 },
  swapDetail: { color: c.muted, fontSize: 12, marginTop: 5 },
  swapRadio: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  swapRadioSelected: { backgroundColor: c.green, borderColor: c.green },
  swapWarning: { color: c.muted, fontSize: 12, lineHeight: 20 },
  empty: {
    flex: 1,
    padding: 32,
    gap: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: c.bg,
  },
  pressed: { opacity: 0.68 },
});
