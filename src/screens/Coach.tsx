import React, { useMemo, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Dumbbell,
  LockKeyhole,
  Sparkles,
  TrendingUp,
} from "lucide-react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useStore } from "../store";
import { buildAdaptivePlan, getUpcomingPlan } from "../lib/training";
import { useTrainingClock } from "../lib/useTrainingClock";
import { shortDays } from "../data";
import type { Workout } from "../types";
import { colors as c, fonts as f } from "../theme";
import {
  Button,
  Card,
  Eyebrow,
  FadeIn,
  SectionTitle,
  Title,
  Txt,
  styles as u,
} from "../components/UI";
import { Studio } from "./Studio";

export default function Coach({
  pro,
  preview = false,
  onUpgrade,
  onWorkout,
  onEdit,
}: {
  pro: boolean;
  preview?: boolean;
  onUpgrade: () => void;
  onWorkout: (workout: Workout) => void;
  onEdit: () => void;
}) {
  const { state } = useStore();
  const { width } = useWindowDimensions();
  const mobile = width < 700;
  const [tab, setTab] = useState<"Your coach" | "My routines">("Your coach");
  const clock = useTrainingClock();
  const result = useMemo(
    () => buildAdaptivePlan(state.profile, state.history),
    [state.profile, state.history, clock],
  );
  const upcoming = getUpcomingPlan(result.plan, state.history);
  const first = upcoming[0];
  return (
    <View style={{ gap: 25 }}>
      <View style={[u.between, { flexWrap: "wrap", gap: 14 }]}>
        <View style={{ gap: 7, flex: 1, minWidth: 230 }}>
          <Eyebrow style={{ color: c.orangeDark }}>
            FORMA PLUS · YOUR TRAINING, CONNECTED
          </Eyebrow>
          <Title>A little more you. Every week.</Title>
          <Txt muted>
            Your choices set the direction. Your completed sessions shape what
            comes next.
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onUpgrade}
          style={{
            minHeight: 48,
            justifyContent: "center",
            paddingHorizontal: 18,
            backgroundColor: c.sage,
            borderRadius: 24,
          }}
        >
          <Txt style={{ fontFamily: f.bold, fontSize: 12 }}>
            {preview
              ? "Preview membership"
              : pro
                ? "Plus membership"
                : "Explore Plus"}
          </Txt>
        </Pressable>
      </View>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#EBECE4",
          padding: 5,
          borderRadius: 17,
          alignSelf: "flex-start",
          maxWidth: "100%",
        }}
      >
        {(["Your coach", "My routines"] as const).map((label) => (
          <Pressable
            key={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === label }}
            aria-selected={tab === label}
            onPress={() => setTab(label)}
            style={{
              minHeight: 48,
              paddingHorizontal: mobile ? 21 : 29,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tab === label ? c.paper : "transparent",
            }}
          >
            <Txt
              style={{
                fontFamily: tab === label ? f.bold : f.medium,
                fontSize: 13,
              }}
            >
              {label}
            </Txt>
          </Pressable>
        ))}
      </View>
      {tab === "My routines" ? (
        <Studio
          pro={pro}
          preview={preview}
          onUpgrade={onUpgrade}
          onStart={onWorkout}
        />
      ) : (
        <>
          <FadeIn>
            <Card
              style={{
                backgroundColor: c.dark,
                borderWidth: 0,
                padding: mobile ? 24 : 34,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  flexDirection: mobile ? "column-reverse" : "row",
                  alignItems: mobile ? "flex-start" : "center",
                  gap: 23,
                }}
              >
                <View style={{ flex: 1, gap: 12 }}>
                  <Eyebrow style={{ color: "#C0D1AE" }}>
                    {pro ? "YOUR ADAPTIVE WEEK" : "MEET YOUR NEXT CHAPTER"}
                  </Eyebrow>
                  <Txt
                    style={{
                      color: "white",
                      fontFamily: f.heavy,
                      fontSize: mobile ? 29 : 36,
                      lineHeight: mobile ? 37 : 45,
                      maxWidth: 580,
                    }}
                  >
                    {pro
                      ? result.basis.completedSessions
                        ? "Your work leaves a mark.\nYour plan responds."
                        : "Your first session\nis the starting point."
                      : "A plan that keeps\ngetting to know you."}
                  </Txt>
                  <Txt
                    style={{ color: "#D5DECE", maxWidth: 560, lineHeight: 23 }}
                  >
                    {pro
                      ? result.basis.completedSessions
                        ? result.basis.completedSessions +
                          (result.basis.completedSessions === 1
                            ? " completed session and "
                            : " completed sessions and ") +
                          result.basis.completedSets +
                          " logged sets inform your next week. See exactly what changed below."
                        : "Start with a week built from your answers. Log a session to unlock your first progression comparisons."
                      : "Go beyond a starting plan. Plus connects your workout history to exercise selection, manageable sets and your next progression decision."}
                  </Txt>
                  <Button
                    onPress={() =>
                      pro && first ? onWorkout(first.workout) : onUpgrade()
                    }
                    style={{ alignSelf: "flex-start", marginTop: 9 }}
                    icon={<ArrowRight size={17} color="white" />}
                  >
                    {pro ? "See my next session" : "Unlock my adaptive plan"}
                  </Button>
                </View>
                <View
                  aria-hidden
                  style={{
                    alignSelf: mobile ? "flex-end" : "center",
                    marginBottom: mobile ? -56 : 0,
                    opacity: mobile ? 0.48 : 1,
                  }}
                >
                  <Svg
                    width={mobile ? 104 : 190}
                    height={mobile ? 104 : 190}
                    viewBox="0 0 190 190"
                  >
                    <Circle
                      cx="95"
                      cy="95"
                      r="88"
                      stroke="#647553"
                      strokeWidth="1"
                      fill="none"
                    />
                    <Circle
                      cx="95"
                      cy="95"
                      r="62"
                      stroke="#647553"
                      strokeWidth="1"
                      fill="none"
                    />
                    <Circle cx="95" cy="95" r="37" fill="#C6D6B1" />
                    <Path
                      d="M78 96l11 11 23-26"
                      stroke="#243023"
                      strokeWidth="5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Circle cx="174" cy="56" r="10" fill="#F0946C" />
                    <Circle cx="50" cy="139" r="7" fill="#C6D6B1" />
                    <Circle cx="105" cy="7" r="4" fill="#C6D6B1" />
                  </Svg>
                </View>
              </View>
            </Card>
          </FadeIn>
          {!pro ? (
            <>
              <View
                style={{
                  gap: 13,
                  flexDirection: width >= 1180 ? "row" : "column",
                }}
              >
                {[
                  {
                    icon: CalendarDays,
                    label: "Adaptive planning",
                    copy: "Exercise choices respond to your recent sessions. Lower completed volume can shape a more manageable next workout.",
                  },
                  {
                    icon: TrendingUp,
                    label: "Progression insights",
                    copy: "Compare actual completed sets and loads. See when to repeat a load or review a small increase.",
                  },
                  {
                    icon: Dumbbell,
                    label: "Your routine studio",
                    copy: "Choose the exercises, order, working sets, repetitions and rest. Save and sync a routine you can actually train.",
                  },
                ].map(({ icon: Icon, label, copy }) => (
                  <Card
                    key={label}
                    style={{
                      flex: width >= 1180 ? 1 : undefined,
                      gap: 12,
                      padding: 23,
                    }}
                  >
                    <View style={u.between}>
                      <Icon size={23} color={c.green} />
                      <LockKeyhole size={15} color={c.muted} />
                    </View>
                    <Txt style={{ fontFamily: f.bold, fontSize: 18 }}>
                      {label}
                    </Txt>
                    <Txt muted style={{ fontSize: 13 }}>
                      {copy}
                    </Txt>
                  </Card>
                ))}
              </View>
              <Txt muted style={{ fontSize: 12 }}>
                Your starting plan, workout logging and basic history remain
                free. Your own data will appear here when you use Plus.
              </Txt>
            </>
          ) : (
            <>
              <View style={[u.between, { flexWrap: "wrap", gap: 10 }]}>
                <SectionTitle title="Why this week looks this way" />
                <Button kind="ghost" onPress={onEdit}>
                  Adjust preferences
                </Button>
              </View>
              <View style={{ gap: 12 }}>
                {result.adjustments.map((item, index) => (
                  <FadeIn key={item.id} delay={index * 65}>
                    <Card style={{ padding: 23, gap: 10 }}>
                      <View style={u.row}>
                        <View
                          style={{
                            backgroundColor: c.sage,
                            width: 34,
                            height: 34,
                            borderRadius: 11,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Sparkles size={17} color={c.green} />
                        </View>
                        <Txt style={{ fontFamily: f.bold, flex: 1 }}>
                          {item.title}
                        </Txt>
                      </View>
                      <Txt muted style={{ fontSize: 13, lineHeight: 22 }}>
                        {item.detail}
                      </Txt>
                    </Card>
                  </FadeIn>
                ))}
              </View>
              <SectionTitle title="Your next seven days" />
              <View style={{ gap: 10 }}>
                {upcoming.map(({ day, workout }) => (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={shortDays[day] + ": " + workout.name}
                    onPress={() => onWorkout(workout)}
                    style={({ pressed }) => ({
                      backgroundColor: c.paper,
                      borderWidth: 1,
                      borderColor: c.line,
                      padding: 20,
                      borderRadius: 17,
                      flexDirection: "row",
                      gap: 17,
                      alignItems: "center",
                      opacity: pressed ? 0.65 : 1,
                    })}
                  >
                    <Eyebrow style={{ color: c.green, width: 34 }}>
                      {shortDays[day]}
                    </Eyebrow>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Txt style={{ fontFamily: f.bold }}>{workout.name}</Txt>
                      <Txt muted style={{ fontSize: 12 }}>
                        {workout.exercises.length} exercises · about{" "}
                        {workout.minutes} min
                      </Txt>
                    </View>
                    <ArrowRight size={17} color={c.ink} />
                  </Pressable>
                ))}
              </View>
              <SectionTitle title="Your progression notebook" />
              {result.progression.length === 0 ? (
                <Card style={{ padding: 25, backgroundColor: c.sage, gap: 11 }}>
                  <TrendingUp size={27} color={c.green} />
                  <Txt style={{ fontFamily: f.bold, fontSize: 19 }}>
                    The first entry is yours to make.
                  </Txt>
                  <Txt muted>
                    Complete a workout with logged sets. Your exercises, loads
                    and comparisons will appear here.
                  </Txt>
                </Card>
              ) : (
                result.progression.map((item) => (
                  <Card key={item.exerciseId} style={{ padding: 24, gap: 13 }}>
                    <View
                      style={[u.between, { alignItems: "flex-start", gap: 15 }]}
                    >
                      <View style={{ gap: 6, flex: 1 }}>
                        <Eyebrow style={{ color: c.orangeDark }}>
                          {item.title}
                        </Eyebrow>
                        <Txt
                          style={{
                            fontFamily: f.bold,
                            fontSize: 20,
                            lineHeight: 27,
                          }}
                        >
                          {item.exerciseName}
                        </Txt>
                      </View>
                      <View
                        style={{
                          borderRadius: 24,
                          padding: 12,
                          backgroundColor: c.sage,
                        }}
                      >
                        <Check size={18} color={c.green} />
                      </View>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 18,
                      }}
                    >
                      <Txt style={{ fontFamily: f.medium, fontSize: 12 }}>
                        {item.completedSessions}{" "}
                        {item.completedSessions === 1 ? "session" : "sessions"}{" "}
                        · {item.completedSets} completed sets
                      </Txt>
                      <Txt muted style={{ fontSize: 12 }}>
                        Last load:{" "}
                        {item.lastLoad === 0
                          ? "Bodyweight / unweighted"
                          : item.lastLoad + " " + item.unit}
                      </Txt>
                    </View>
                    <Txt muted style={{ fontSize: 13, lineHeight: 22 }}>
                      {item.detail}
                    </Txt>
                    <Txt muted style={{ fontSize: 11 }}>
                      Last logged{" "}
                      {new Date(item.lastCompletedAt).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" },
                      )}
                    </Txt>
                  </Card>
                ))
              )}
              <Txt muted style={{ fontSize: 11, lineHeight: 18 }}>
                Suggestions come from your preferences and recorded training.
                They do not measure recovery or change your weights
                automatically. Choose loads and movements that feel controlled
                and comfortable.
              </Txt>
            </>
          )}
        </>
      )}
    </View>
  );
}
