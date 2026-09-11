import type {
  Exercise,
  ExercisePrescription,
  Profile,
  Workout,
  WorkoutRecord,
} from "../types";
import { exerciseById, exercises } from "./exercise-catalog";

export type MovementPattern =
  | "squat"
  | "hinge"
  | "horizontal-push"
  | "vertical-push"
  | "horizontal-pull"
  | "vertical-pull"
  | "upper-back"
  | "knee-extension"
  | "knee-flexion"
  | "shoulder-abduction"
  | "core"
  | "arms"
  | "calves"
  | "mobility";
type ExerciseMetadata = {
  pattern: MovementPattern;
  compound: boolean;
  unilateral?: boolean;
  minExperience?: number;
  bench?: boolean;
};
const meta = (
  pattern: MovementPattern,
  compound = true,
  extra: Partial<ExerciseMetadata> = {},
): ExerciseMetadata => ({ pattern, compound, ...extra });

export const exerciseMetadata: Record<string, ExerciseMetadata> = {
  "goblet-squat": meta("squat"),
  "bench-press": meta("horizontal-push", true, { bench: true }),
  row: meta("horizontal-pull", true, { unilateral: true }),
  rdl: meta("hinge"),
  press: meta("vertical-push"),
  lunge: meta("squat", true, { unilateral: true }),
  squat: meta("squat"),
  pushup: meta("horizontal-push"),
  bridge: meta("hinge"),
  deadbug: meta("core", false, { unilateral: true }),
  birddog: meta("core", false, { unilateral: true }),
  calf: meta("calves", false),
  pulldown: meta("vertical-pull"),
  legpress: meta("squat"),
  "cable-row": meta("horizontal-pull"),
  curl: meta("arms", false),
  lateral: meta("shoulder-abduction", false),
  catcow: meta("mobility", false),
  rotation: meta("mobility", false, { unilateral: true }),
  wallslide: meta("mobility", false),
  stepup: meta("squat", true, { unilateral: true }),
  triceps: meta("arms", false),
  "floor-press": meta("horizontal-push"),
  "split-squat": meta("squat", true, { unilateral: true, minExperience: 1 }),
  "dumbbell-deadlift": meta("hinge"),
  "hammer-curl": meta("arms", false),
  "overhead-triceps": meta("arms", false, { minExperience: 1 }),
  "chest-press-machine": meta("horizontal-push"),
  "hamstring-curl": meta("knee-flexion", false),
  "leg-extension": meta("knee-extension", false),
  "face-pull": meta("upper-back", false),
  "standing-cable-press": meta("horizontal-push", true, { minExperience: 1 }),
  "kneeling-pushup": meta("horizontal-push"),
  "full-pushup": meta("horizontal-push", true, { minExperience: 1 }),
  "pike-pushup": meta("vertical-push", true, { minExperience: 2 }),
  "single-leg-bridge": meta("hinge", true, {
    unilateral: true,
    minExperience: 1,
  }),
  "prone-y-raise": meta("upper-back", false),
  "reverse-snow-angel": meta("upper-back", false),
  "standing-hip-hinge": meta("hinge"),
  "heel-tap": meta("core", false, { unilateral: true }),
};

const level = (profile: Profile) =>
  ["Getting started", "Some experience", "Very experienced"].indexOf(
    profile.experience,
  );
export function compatibleExercise(
  exercise: Exercise,
  profile: Profile,
): boolean {
  const details = exerciseMetadata[exercise.id];
  return (
    (profile.equipment === "Full gym" ||
      exercise.equipment === "Bodyweight" ||
      exercise.equipment === "Any" ||
      exercise.equipment === profile.equipment) &&
    (!details?.bench || profile.equipment === "Full gym") &&
    (details?.minExperience ?? 0) <= level(profile)
  );
}

/** Prescriptions are transparent defaults; they never estimate a user's maximum load. */
export function prescriptionForExercise(
  exercise: Exercise,
  profile: Profile,
): ExercisePrescription {
  const details = exerciseMetadata[exercise.id];
  const control =
    details?.pattern === "core" ||
    details?.pattern === "mobility" ||
    details?.pattern === "upper-back";
  const strength = profile.goal === "Build strength" && details?.compound;
  const reps = control
    ? parseInt(exercise.reps, 10)
    : strength
      ? 8
      : profile.goal === "Build muscle"
        ? 10
        : 12;
  return {
    exerciseId: exercise.id,
    sets: level(profile) === 0 ? Math.min(2, exercise.sets) : exercise.sets,
    reps,
    restSeconds: control
      ? exercise.rest
      : strength
        ? 120
        : profile.goal === "Build muscle" && details?.compound
          ? 90
          : 60,
  };
}

/**
 * Planning estimate: 5 minutes to prepare, 3 seconds per repetition,
 * the prescribed rests between sets, and 45 seconds between exercises.
 * Unilateral exercises include both sides. This is not a claim of actual elapsed time.
 */
export function estimateWorkoutMinutes(
  workout: Workout,
  profile: Profile,
): number {
  if (!workout.exercises.length) return 0;
  const warmup = workout.category === "Mobility" ? 60 : 300;
  const seconds = workout.exercises.reduce(
    (sum, id) => {
      const exercise = exerciseById(id);
      if (!exercise) return sum;
      const target =
        workout.prescription?.find((p) => p.exerciseId === id) ??
        prescriptionForExercise(exercise, profile);
      const sides = exerciseMetadata[id]?.unilateral ? 2 : 1;
      return (
        sum +
        target.sets * target.reps * 3 * sides +
        Math.max(0, target.sets - 1) * target.restSeconds
      );
    },
    warmup + Math.max(0, workout.exercises.length - 1) * 45,
  );
  return Math.ceil(seconds / 60);
}

export type PlanDay = { day: number; workout: Workout };
export function hasCompletedTrainingToday(
  history: WorkoutRecord[],
  now = new Date(),
): boolean {
  return history.some(
    (record) =>
      record.sets.some((set) => set.done) &&
      Date.parse(record.completedAt) <= now.getTime() &&
      new Date(record.completedAt).toDateString() === now.toDateString(),
  );
}

/** A completed training day moves today's slot to next week, without hiding it. */
export function getUpcomingPlan(
  plan: PlanDay[],
  history: WorkoutRecord[],
  now = new Date(),
): PlanDay[] {
  const completedToday = hasCompletedTrainingToday(history, now);
  const distance = (day: number) => {
    const difference = (day - now.getDay() + 7) % 7;
    return difference === 0 && completedToday ? 7 : difference;
  };
  return [...plan].sort((a, b) => distance(a.day) - distance(b.day));
}
export type TrainingAdjustment = {
  id: string;
  title: string;
  detail: string;
  exerciseIds: string[];
};
export type ProgressionInsight = {
  exerciseId: string;
  exerciseName: string;
  status: "build-baseline" | "repeat" | "consider-increase";
  title: string;
  detail: string;
  completedSessions: number;
  completedSets: number;
  lastCompletedAt: string;
  lastLoad: number;
  unit: "kg" | "lb";
  targetReps: number;
  suggestedLoad?: number;
};
export type AdaptivePlanResult = {
  plan: PlanDay[];
  adjustments: TrainingAdjustment[];
  progression: ProgressionInsight[];
  basis: {
    completedSessions: number;
    completedSets: number;
    latestSessionAt: string | null;
  };
};

const validHistory = (history: WorkoutRecord[]) => {
  const ordered = history
    .filter(
      (record) =>
        Number.isFinite(Date.parse(record.completedAt)) &&
        record.sets.some((set) => set.done),
    )
    .slice()
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  return ordered.filter(
    (record, index) =>
      ordered.findIndex((other) => other.id === record.id) === index,
  );
};
const stableHash = (text: string) =>
  [...text].reduce(
    (sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
type ComposeOptions = {
  nextIndex?: number;
  recentMuscles?: Map<string, number>;
  reduceNextVolume?: boolean;
};

/**
 * Rank compatible exercises by movement coverage, equipment, experience and
 * weekly use. Days select a training split, never a fixed workout ID sequence.
 */
export function composePlan(
  profile: Profile,
  history: WorkoutRecord[] = [],
  options: ComposeOptions = {},
): PlanDay[] {
  const days = [...new Set(profile.days)].sort((a, b) => (a || 7) - (b || 7));
  const available = exercises.filter(
    (exercise) =>
      compatibleExercise(exercise, profile) &&
      exerciseMetadata[exercise.id]?.pattern !== "mobility",
  );
  const usage = new Map<string, number>();
  const latest = validHistory(history)[0];
  const latestIds = new Set(
    latest?.sets.filter((set) => set.done).map((set) => set.exerciseId),
  );
  const supportsPull = available.some((exercise) =>
    ["horizontal-pull", "vertical-pull"].includes(
      exerciseMetadata[exercise.id].pattern,
    ),
  );
  const pulling: MovementPattern = supportsPull
    ? "horizontal-pull"
    : "upper-back";
  const volumeCap = profile.duration <= 30 ? 5 : profile.duration <= 45 ? 6 : 8;
  return days.map((day, index) => {
    const isNext = index === options.nextIndex;
    let focus: "full" | "upper" | "lower" =
      days.length < 4 || (days.length === 5 && index === 4)
        ? "full"
        : index % 2 === 0
          ? "upper"
          : "lower";
    // A same-week next session can prioritize the less recently trained half.
    if (isNext && options.recentMuscles?.size && days.length >= 4) {
      const lowerSets = options.recentMuscles.get("Legs") ?? 0;
      const upperSets = ["Chest", "Back", "Shoulders", "Arms"].reduce(
        (sum, muscle) => sum + (options.recentMuscles!.get(muscle) ?? 0),
        0,
      );
      if (upperSets >= 4 && upperSets > lowerSets) focus = "lower";
      else if (lowerSets >= 4 && lowerSets > upperSets) focus = "upper";
    }
    const lowerFirst: MovementPattern = index % 2 ? "hinge" : "squat";
    const secondLower: MovementPattern =
      lowerFirst === "squat" ? "hinge" : "squat";
    const priorities: MovementPattern[] =
      focus === "upper"
        ? [
            "horizontal-push",
            pulling,
            "vertical-push",
            supportsPull ? "vertical-pull" : "upper-back",
            "core",
            "arms",
          ]
        : focus === "lower"
          ? [lowerFirst, secondLower, "core", "squat", "calves", "knee-flexion"]
          : [
              lowerFirst,
              "horizontal-push",
              pulling,
              secondLower,
              "core",
              "vertical-push",
              supportsPull ? "vertical-pull" : "upper-back",
              "arms",
            ];
    const chosen: string[] = [];
    const targets: ExercisePrescription[] = [];
    const focusLabel =
      focus === "upper"
        ? "Upper body"
        : focus === "lower"
          ? "Lower body"
          : "Full body";
    const workout: Workout = {
      id:
        "plan-" +
        day +
        "-" +
        stableHash(
          [
            profile.goal,
            profile.equipment,
            profile.experience,
            profile.duration,
            days.join(","),
          ].join("|"),
        ).toString(36),
      name: focusLabel + " · " + (index + 1),
      subtitle:
        profile.goal === "Build strength"
          ? "Controlled reps. Room to get stronger."
          : profile.goal === "Build muscle"
            ? "Purposeful volume, built around you."
            : "A balanced session for a consistent week.",
      category: profile.equipment === "Bodyweight" ? "Bodyweight" : "Strength",
      minutes: 0,
      exercises: chosen,
      prescription: targets,
      accent:
        focus === "upper"
          ? "#E7DACE"
          : focus === "lower"
            ? "#DEDCCF"
            : "#D8DEC8",
      reasoning: [
        days.length >= 4
          ? "Upper and lower emphasis spreads training across " +
            days.length +
            " days."
          : "Full-body sessions cover the main movement patterns across your week.",
        profile.experience === "Getting started"
          ? "Two working sets per exercise to start."
          : "Working sets and rests follow your goal and available time.",
        "Time includes a 5-minute warm-up, working sets, rest and exercise changes.",
      ],
    };
    if (!supportsPull)
      workout.reasoning!.push(
        "Floor upper-back work is included; bodyweight equipment does not replace loaded pulling.",
      );
    const choose = (pattern: MovementPattern): boolean => {
      const eligible = available.filter(
        (exercise) =>
          !chosen.includes(exercise.id) &&
          exerciseMetadata[exercise.id].pattern === pattern,
      );
      const ranked = eligible
        .map((exercise) => {
          const details = exerciseMetadata[exercise.id];
          const loaded = exercise.equipment !== "Bodyweight";
          const equipmentScore =
            profile.equipment === "Bodyweight" ? 0 : loaded ? 30 : -20;
          const goalScore =
            profile.goal === "Build strength" && details.compound
              ? 18
              : profile.goal === "Build muscle" && !details.compound
                ? 6
                : 0;
          const experienceScore =
            profile.experience === "Very experienced"
              ? (details.minExperience ?? 0) * 5
              : 0;
          const recentPenalty = isNext
            ? Math.min(
                50,
                (options.recentMuscles?.get(exercise.muscle) ?? 0) * 5,
              )
            : 0;
          return {
            exercise,
            score:
              equipmentScore +
              goalScore +
              experienceScore -
              (usage.get(exercise.id) ?? 0) * 28 -
              (latestIds.has(exercise.id) ? 10 : 0) -
              recentPenalty +
              (stableHash(profile.goal + ":" + day + ":" + exercise.id) % 11),
          };
        })
        .sort(
          (a, b) =>
            b.score - a.score || a.exercise.id.localeCompare(b.exercise.id),
        );
      for (const { exercise } of ranked) {
        const target = prescriptionForExercise(exercise, profile);
        if (isNext && options.reduceNextVolume)
          target.sets = Math.max(2, target.sets - 1);
        if (isNext && (options.recentMuscles?.get(exercise.muscle) ?? 0) >= 4)
          target.sets = Math.min(target.sets, 2);
        chosen.push(exercise.id);
        targets.push(target);
        if (estimateWorkoutMinutes(workout, profile) <= profile.duration) {
          usage.set(exercise.id, (usage.get(exercise.id) ?? 0) + 1);
          return true;
        }
        chosen.pop();
        targets.pop();
      }
      return false;
    };
    for (const pattern of priorities) {
      if (chosen.length >= volumeCap) break;
      choose(pattern);
    }
    // Longer budgets can add a second variation where equipment supports it.
    const extras: MovementPattern[] =
      focus === "upper"
        ? ["shoulder-abduction", "arms", "upper-back"]
        : focus === "lower"
          ? ["knee-extension", "hinge", "calves"]
          : ["core", "arms"];
    for (const pattern of extras) {
      if (chosen.length >= volumeCap) break;
      choose(pattern);
    }
    const orderedIds = [...chosen].sort(
      (a, b) =>
        Number(exerciseMetadata[b].compound) -
        Number(exerciseMetadata[a].compound),
    );
    const orderedTargets = orderedIds.map(
      (id) => targets.find((target) => target.exerciseId === id)!,
    );
    chosen.splice(0, chosen.length, ...orderedIds);
    targets.splice(0, targets.length, ...orderedTargets);
    workout.minutes = estimateWorkoutMinutes(workout, profile);
    return { day, workout };
  });
}

function convertedLoad(weight: number, from: "kg" | "lb", to: "kg" | "lb") {
  return weight * (from === to ? 1 : to === "kg" ? 0.45359237 : 2.20462262);
}
const roundLoad = (value: number) => Math.round(value * 10) / 10;

/**
 * Reviewable double-progression suggestions only. Two fully completed sessions
 * at the same load, with two extra reps on every set, are needed for an increase.
 * Never infers recovery, effort, pain or a one-repetition maximum from logs.
 */
export function getProgressionInsights(
  profile: Profile,
  history: WorkoutRecord[],
): ProgressionInsight[] {
  const records = validHistory(history);
  const ids = [
    ...new Set(
      records.flatMap((record) =>
        record.sets.filter((set) => set.done).map((set) => set.exerciseId),
      ),
    ),
  ];
  return ids.flatMap((id) => {
    const exercise = exerciseById(id);
    if (!exercise) return [];
    const sessions = records.filter((record) =>
      record.sets.some((set) => set.exerciseId === id && set.done),
    );
    const latest = sessions[0];
    const lastSets = latest.sets.filter(
      (set) => set.exerciseId === id && set.done,
    );
    const lastLoad = roundLoad(
      convertedLoad(lastSets[0].weight, latest.unit, profile.unit),
    );
    const latestTarget =
      latest.prescription?.find((target) => target.exerciseId === id) ??
      prescriptionForExercise(exercise, profile);
    const targetReps = latestTarget.reps;
    const base: ProgressionInsight = {
      exerciseId: id,
      exerciseName: exercise.name,
      status: "build-baseline",
      title: "Build your baseline",
      detail:
        "One logged session. Repeat a comfortable load and record every set to establish a comparison.",
      completedSessions: sessions.length,
      completedSets: sessions.reduce(
        (sum, record) =>
          sum +
          record.sets.filter((set) => set.exerciseId === id && set.done).length,
        0,
      ),
      lastCompletedAt: latest.completedAt,
      lastLoad,
      unit: profile.unit,
      targetReps,
    };
    if (sessions.length < 2) return [base];
    const pair = sessions.slice(0, 2);
    const consistent =
      lastLoad > 0 &&
      pair.every((record) => {
        const sets = record.sets.filter((set) => set.exerciseId === id);
        const recordedTarget =
          record.prescription?.find((target) => target.exerciseId === id) ??
          prescriptionForExercise(exercise, profile);
        return (
          recordedTarget.reps === targetReps &&
          recordedTarget.sets === latestTarget.sets &&
          sets.length >= recordedTarget.sets &&
          sets.every(
            (set) =>
              set.done &&
              set.reps >= targetReps + 2 &&
              Math.abs(
                convertedLoad(set.weight, record.unit, profile.unit) - lastLoad,
              ) < 0.11,
          )
        );
      });
    if (consistent && ["Dumbbells", "Full gym"].includes(exercise.equipment)) {
      // A bounded 2.5% suggestion is shown for review, not applied to the session.
      const suggestedLoad = roundLoad(lastLoad * 1.025);
      if (suggestedLoad > lastLoad)
        return [
          {
            ...base,
            status: "consider-increase" as const,
            title: "Consider a small increase",
            suggestedLoad,
            detail:
              "Every set in your last two sessions reached at least " +
              (targetReps + 2) +
              " reps at " +
              lastLoad +
              " " +
              profile.unit +
              ". If those reps felt controlled, review " +
              suggestedLoad +
              " " +
              profile.unit +
              " next time, or keep the same load. Use a smaller available increment; no change is applied automatically.",
          },
        ];
    }
    return [
      {
        ...base,
        status: "repeat" as const,
        title: "Keep building at this level",
        detail:
          exercise.equipment === "Bodyweight"
            ? "You have " +
              sessions.length +
              " logged sessions. Build controlled repetitions before choosing a harder variation."
            : "Your last two sessions do not yet show every planned set at the same load and at least " +
              (targetReps + 2) +
              " reps. Repeat a manageable load and aim for consistent sets.",
      },
    ];
  });
}

export function buildAdaptivePlan(
  profile: Profile,
  history: WorkoutRecord[],
  options: { now?: Date } = {},
): AdaptivePlanResult {
  const now = options.now ?? new Date();
  const records = validHistory(history).filter(
    (record) => Date.parse(record.completedAt) <= now.getTime(),
  );
  const days = [...new Set(profile.days)].sort((a, b) => (a || 7) - (b || 7));
  const completedToday = hasCompletedTrainingToday(records, now);
  const distance = (day: number) =>
    day === now.getDay() && completedToday ? 7 : (day - now.getDay() + 7) % 7;
  const nextIndex = days.reduce(
    (best, day, index) => (distance(day) < distance(days[best]) ? index : best),
    0,
  );
  // There is no logged time-of-day preference. Do not assume current workload
  // still describes recovery on a later scheduled day.
  const nextIsToday = !completedToday && days[nextIndex] === now.getDay();
  const recent = nextIsToday
    ? records.filter(
        (record) =>
          now.getTime() - Date.parse(record.completedAt) < 36 * 60 * 60 * 1000,
      )
    : [];
  const recentMuscles = new Map<string, number>();
  for (const record of recent)
    for (const set of record.sets.filter((set) => set.done)) {
      const exercise = exerciseById(set.exerciseId);
      if (exercise)
        recentMuscles.set(
          exercise.muscle,
          (recentMuscles.get(exercise.muscle) ?? 0) + 1,
        );
    }
  const latest = records[0];
  const latestDone = latest?.sets.filter((set) => set.done).length ?? 0;
  const reduceNextVolume =
    level(profile) > 0 &&
    !!latest &&
    latest.sets.length >= 6 &&
    latestDone / latest.sets.length < 0.65 &&
    now.getTime() - Date.parse(latest.completedAt) < 7 * 24 * 60 * 60 * 1000;
  const plan = composePlan(profile, records, {
    nextIndex,
    recentMuscles,
    reduceNextVolume,
  });
  const basePlan = composePlan(profile);
  const adjustments: TrainingAdjustment[] = [];
  if (records.length) {
    const changed = plan.flatMap((entry, index) =>
      entry.workout.exercises.filter(
        (id) => !basePlan[index]?.workout.exercises.includes(id),
      ),
    );
    if (changed.length)
      adjustments.push({
        id: "exercise-rotation",
        title: "Fresh variations, familiar movement patterns",
        detail:
          "Compatible alternatives are ranked against your latest completed exercises while preserving your weekly movement coverage.",
        exerciseIds: [...new Set(changed)],
      });
  }
  const recentSetTotal = [...recentMuscles.values()].reduce(
    (sum, count) => sum + count,
    0,
  );
  if (recentSetTotal >= 4) {
    adjustments.push({
      id: "recent-training",
      title: "Recent work shapes your next session",
      detail:
        [...recentMuscles]
          .map(([muscle, count]) => muscle + ": " + count + " completed sets")
          .join(" · ") +
        " in the last 36 hours. Areas with four or more sets receive at most two sets per exercise today. Where the split allows, the other half of the body takes priority. This uses logged workload, not a measured recovery score.",
      exerciseIds: recent
        .flatMap((record) =>
          record.sets.filter((set) => set.done).map((set) => set.exerciseId),
        )
        .filter((id, index, ids) => ids.indexOf(id) === index),
    });
  }
  if (reduceNextVolume)
    adjustments.push({
      id: "finishable-volume",
      title: "A more manageable next session",
      detail:
        "Your latest workout ended after " +
        latestDone +
        " of " +
        latest!.sets.length +
        " planned sets. The next session removes one set where there were more than two. We do not assume why you stopped.",
      exerciseIds: plan[nextIndex]?.workout.exercises ?? [],
    });
  if (!records.length)
    adjustments.push({
      id: "first-session",
      title: "Your preferences are the starting point",
      detail:
        "Complete and log your first workout. FORMA will then use your actual exercises, sets and loads to adapt the next plan.",
      exerciseIds: [],
    });
  else if (!adjustments.length)
    adjustments.push({
      id: "maintain-plan",
      title: "Keep a consistent starting point",
      detail:
        "Your completed history does not call for a workload adjustment today. Your chosen schedule and equipment still shape the plan.",
      exerciseIds: [],
    });
  return {
    plan,
    adjustments,
    progression: getProgressionInsights(profile, records),
    basis: {
      completedSessions: records.length,
      completedSets: records.reduce(
        (sum, record) => sum + record.sets.filter((set) => set.done).length,
        0,
      ),
      latestSessionAt: latest?.completedAt ?? null,
    },
  };
}
