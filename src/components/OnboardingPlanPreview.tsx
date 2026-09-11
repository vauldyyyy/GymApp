import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ArrowUpRight, Check, Dumbbell } from "lucide-react-native";
import { buildPlan, exerciseById } from "../data";
import { colors, fonts } from "../theme";
import type { Profile } from "../types";

type Props = {
  profile: Profile;
  reducedMotion: boolean;
  expanded?: boolean;
  step?: number;
  confirmed?: number[];
};

const week = [
  { id: 1, short: "M", full: "Monday", label: "Mon" },
  { id: 2, short: "T", full: "Tuesday", label: "Tue" },
  { id: 3, short: "W", full: "Wednesday", label: "Wed" },
  { id: 4, short: "T", full: "Thursday", label: "Thu" },
  { id: 5, short: "F", full: "Friday", label: "Fri" },
  { id: 6, short: "S", full: "Saturday", label: "Sat" },
  { id: 0, short: "S", full: "Sunday", label: "Sun" },
];

function Weekday({
  day,
  selected,
  reducedMotion,
}: {
  day: (typeof week)[number];
  selected: boolean;
  reducedMotion: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const previous = useRef(selected);

  useEffect(() => {
    scale.stopAnimation();
    const changed = previous.current !== selected;
    previous.current = selected;
    if (reducedMotion || !changed) {
      scale.setValue(1);
      return;
    }
    scale.setValue(selected ? 0.86 : 1.05);
    const animation = Animated.spring(scale, {
      toValue: 1,
      stiffness: 270,
      damping: 22,
      mass: 0.65,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [selected, reducedMotion, scale]);

  return (
    <Animated.View
      accessible
      accessibilityLabel={day.full + ": " + (selected ? "training" : "rest")}
      style={[
        styles.day,
        selected && styles.daySelected,
        { transform: [{ scale }] },
      ]}
    >
      <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
        {day.short}
      </Text>
      {selected ? (
        <Check size={9} color={colors.cream} strokeWidth={2.8} aria-hidden />
      ) : (
        <View style={styles.restMark} aria-hidden />
      )}
    </Animated.View>
  );
}

export default function OnboardingPlanPreview({
  profile,
  reducedMotion,
  expanded = false,
  step = 1,
  confirmed = [1, 2, 3, 4, 5],
}: Props) {
  const complete = [1, 2, 3, 4, 5].every((question) =>
    confirmed.includes(question),
  );
  const trainingKey = [
    profile.goal,
    profile.experience,
    profile.equipment,
    [...profile.days].sort().join(","),
    profile.duration,
  ].join("|");
  const plan = useMemo(() => buildPlan(profile), [trainingKey]);
  const first = complete ? plan[0]?.workout : undefined;
  const entrance = useRef(new Animated.Value(1)).current;
  const previous = useRef(trainingKey);
  const revealed = useRef(false);

  useLayoutEffect(() => {
    entrance.stopAnimation();
    const changed = previous.current !== trainingKey;
    const reveal = step === 6 && !revealed.current;
    previous.current = trainingKey;
    if (step === 6) revealed.current = true;
    if (reducedMotion || (!changed && !reveal)) {
      entrance.setValue(1);
      return;
    }
    entrance.setValue(0);
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: reveal ? 420 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [trainingKey, reducedMotion, step, entrance]);

  return (
    <Animated.View
      style={[
        styles.card,
        expanded && styles.cardExpanded,
        {
          opacity: entrance.interpolate({
            inputRange: [0, 1],
            outputRange: [0.4, 1],
          }),
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [step === 6 ? 12 : 5, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.liveDot} aria-hidden />
        <Text style={styles.eyebrow}>
          {step === 6 ? "YOUR FIRST WEEK" : "YOUR PLAN, TAKING SHAPE"}
        </Text>
        <ArrowUpRight
          size={15}
          color={colors.green}
          strokeWidth={1.6}
          aria-hidden
        />
      </View>

      <View style={styles.summary}>
        <View style={styles.stats}>
          <Text
            style={[styles.statNumber, expanded && styles.statNumberExpanded]}
          >
            {confirmed.includes(4) ? profile.days.length : "—"}
            <Text style={styles.statLabel}>
              {plan.length === 1 ? " day / week" : " days / week"}
            </Text>
          </Text>
          <View style={styles.statDivider} />
          <View>
            <Text
              style={[styles.statNumber, expanded && styles.statNumberExpanded]}
            >
              {confirmed.includes(5) ? profile.duration : "—"}
              <Text style={styles.statLabel}>
                {confirmed.includes(5) ? " min budget" : " choose time"}
              </Text>
            </Text>
            {expanded && complete && (
              <Text style={styles.preference}>
                durations below are estimates
              </Text>
            )}
          </View>
        </View>
        {expanded && (
          <Text style={styles.direction}>
            {confirmed.includes(1) ? profile.goal : "Your direction"} ·{" "}
            {confirmed.includes(3) ? profile.equipment : "Your equipment"}
          </Text>
        )}
      </View>

      <View style={styles.week}>
        {week.map((day) => (
          <Weekday
            key={day.id}
            day={day}
            selected={confirmed.includes(4) && profile.days.includes(day.id)}
            reducedMotion={reducedMotion}
          />
        ))}
      </View>

      {first ? (
        <View style={[styles.workout, expanded && styles.workoutExpanded]}>
          <View style={styles.workoutHeader}>
            <View style={styles.workoutIcon} aria-hidden>
              <Dumbbell size={17} color={colors.green} strokeWidth={1.6} />
            </View>
            <View style={styles.workoutCopy}>
              {expanded && (
                <Text style={styles.workoutEyebrow}>YOUR FIRST SESSION</Text>
              )}
              <Text style={styles.workoutTitle}>{first.name}</Text>
              <Text style={styles.workoutMeta}>
                {first.exercises.length} exercises · {first.minutes} min
              </Text>
            </View>
          </View>
          {expanded && (
            <View style={styles.exercises}>
              {first.exercises.slice(0, 3).map((id, index) => {
                const exercise = exerciseById(id);
                const sets =
                  first.prescription?.find((item) => item.exerciseId === id)
                    ?.sets ??
                  (profile.experience === "Getting started"
                    ? Math.min(2, exercise.sets)
                    : exercise.sets);
                return (
                  <View key={id} style={styles.exercise}>
                    <Text style={styles.exerciseIndex}>
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseSets}>{sets} sets</Text>
                  </View>
                );
              })}
              {first.exercises.length > 3 && (
                <Text style={styles.moreExercises}>
                  + {first.exercises.length - 3} more{" "}
                  {first.exercises.length === 4 ? "exercise" : "exercises"}
                </Text>
              )}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.workoutTitle}>
            {confirmed.includes(1) ? profile.goal : "A week built around you."}
          </Text>
          <Text style={styles.workoutMeta}>
            {confirmed.includes(3) ? profile.equipment + " movements. " : ""}
            {complete
              ? "Choose your training days to see your first session."
              : "Finish your choices to reveal your exercises, sets and estimated session times."}
          </Text>
        </View>
      )}

      {expanded && complete && plan.length > 0 && (
        <View style={styles.schedule}>
          <Text style={styles.scheduleEyebrow}>A LOOK AT YOUR WEEK</Text>
          {plan.slice(0, 5).map(({ day, workout }) => (
            <View key={day} style={styles.scheduleRow}>
              <Text style={styles.scheduleDay}>
                {week.find((entry) => entry.id === day)?.label}
              </Text>
              <Text style={styles.scheduleWorkout}>{workout.name}</Text>
              <Text style={styles.scheduleMinutes}>{workout.minutes}m</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.footnote}>
        {step < 6
          ? confirmed.length +
            " of 5 choices made. Your answers shape your plan."
          : "Built from your goal, experience, equipment, days and time budget."}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 19,
    padding: 16,
    borderWidth: 1,
    borderColor: "#D9E0CF",
    backgroundColor: colors.sage,
    gap: 11,
  },
  cardExpanded: { padding: 23, borderRadius: 23, gap: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 7 },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  eyebrow: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 1.3,
    color: colors.green,
  },
  summary: { gap: 9 },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 17,
  },
  statNumber: {
    fontFamily: fonts.heavy,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  statNumberExpanded: { fontSize: 31, lineHeight: 39 },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0,
    color: colors.green,
  },
  statDivider: { height: 24, width: 1, backgroundColor: "#C9D1BD" },
  preference: { fontFamily: fonts.regular, fontSize: 10, color: colors.green },
  direction: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 19,
    color: colors.green,
  },
  week: { flexDirection: "row", gap: 5 },
  day: {
    flex: 1,
    minWidth: 0,
    minHeight: 34,
    paddingVertical: 5,
    gap: 2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#F2F4ED",
  },
  daySelected: { backgroundColor: colors.green },
  dayText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 13,
    color: colors.green,
  },
  dayTextSelected: { color: colors.paper },
  restMark: {
    width: 5,
    height: 1,
    marginVertical: 4,
    backgroundColor: "#A9B49B",
  },
  workout: { paddingTop: 9, borderTopWidth: 1, borderTopColor: "#D1D8C6" },
  workoutExpanded: {
    borderTopWidth: 0,
    borderRadius: 15,
    padding: 15,
    backgroundColor: colors.paper,
  },
  workoutHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  workoutIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F4ED",
  },
  workoutCopy: { flex: 1, minWidth: 0 },
  workoutEyebrow: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.1,
    color: colors.muted,
    marginBottom: 4,
  },
  workoutTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink,
  },
  workoutMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.green,
    marginTop: 2,
  },
  exercises: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 10,
  },
  exercise: { flexDirection: "row", alignItems: "center", gap: 9 },
  exerciseIndex: {
    fontFamily: fonts.medium,
    fontSize: 9,
    color: colors.muted,
    minWidth: 16,
  },
  exerciseName: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
  },
  exerciseSets: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  moreExercises: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 16,
    color: colors.muted,
    marginLeft: 25,
  },
  empty: { gap: 3, paddingTop: 4 },
  schedule: { gap: 10 },
  scheduleEyebrow: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.3,
    color: colors.green,
    marginBottom: 2,
  },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  scheduleDay: {
    width: 26,
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.green,
  },
  scheduleWorkout: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
  },
  scheduleMinutes: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.green,
  },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.green,
  },
});
