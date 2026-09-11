import React from "react";
import {
  ImageBackground,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  Leaf,
  Play,
  Sparkles,
  Target,
} from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useStore } from "../store";
import { useTrainingClock } from "../lib/useTrainingClock";
import {
  buildPlan,
  shortDays,
  weekHistory,
  weekStart,
  workouts,
  adaptWorkout,
  buildAdaptivePlan,
  getUpcomingPlan,
} from "../data";
import { Workout } from "../types";
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
import WorkoutCard from "../components/WorkoutCard";
export default function Dashboard({
  onWorkout,
  onPlan,
  onProgress,
  onOnboard,
  pro = false,
  onCoach,
}: {
  onWorkout: (w: Workout) => void;
  onPlan: () => void;
  onProgress: () => void;
  onOnboard: () => void;
  pro?: boolean;
  onCoach: () => void;
}) {
  const { state } = useStore();
  useTrainingClock();
  const { width } = useWindowDimensions();
  const wide = width >= 1180;
  const mobile = width < 700;
  const p = state.profile;
  const plan = pro ? buildAdaptivePlan(p, state.history).plan : buildPlan(p);
  const today = new Date();
  const ordered = getUpcomingPlan(plan, state.history, today);
  const next = ordered[0].workout;
  const recent = weekHistory(state.history);
  const doneDays = new Set(
    recent.map((h) => new Date(h.completedAt).toDateString()),
  ).size;
  const completion = Math.min(1, doneDays / p.days.length);
  const monday = weekStart();
  return (
    <View style={{ gap: 28 }}>
      <FadeIn>
        <View style={[u.between, { alignItems: "flex-end" }]}>
          <View style={{ gap: 8, flex: 1 }}>
            <Eyebrow style={{ color: c.muted }}>
              YOUR DAILY DOSE OF MOMENTUM
            </Eyebrow>
            <Title
              style={{
                fontSize: mobile ? 32 : 42,
                lineHeight: mobile ? 40 : 53,
              }}
            >
              A little stronger. Every day.
            </Title>
            <Txt muted>
              Your pace. Your progress. Let’s make today count
              {p.name ? `, ${p.name.split(" ")[0]}` : ""}.
            </Txt>
          </View>
          {!mobile && (
            <View
              style={[
                u.row,
                {
                  padding: 12,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: 30,
                },
              ]}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: c.orange,
                }}
              />
              <Txt style={{ fontSize: 12 }}>
                {today.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Txt>
            </View>
          )}
        </View>
      </FadeIn>
      {!p.onboardingDone && (
        <Card style={{ backgroundColor: c.sage, padding: 18 }}>
          <View style={[u.between, { flexWrap: "wrap" }]}>
            <View style={{ gap: 4 }}>
              <Txt style={{ fontFamily: f.bold }}>
                A plan that fits you starts here.
              </Txt>
              <Txt muted style={{ fontSize: 12 }}>
                Tell us a little about your goals and your week.
              </Txt>
            </View>
            <Button kind="dark" onPress={onOnboard}>
              Personalize my plan
            </Button>
          </View>
        </Card>
      )}
      {p.onboardingDone && (
        <Pressable
          accessibilityRole="button"
          onPress={onCoach}
          style={({ pressed }) => ({
            padding: 19,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "#D6DDCA",
            backgroundColor: c.sage,
            flexDirection: "row",
            gap: 13,
            alignItems: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Sparkles size={23} color={c.green} />
          <View style={{ flex: 1, gap: 3 }}>
            <Txt style={{ fontFamily: f.bold, fontSize: 14 }}>
              {pro ? "Your adaptive coach is ready" : "Meet FORMA Plus"}
            </Txt>
            <Txt style={{ color: c.green, fontSize: 12 }}>
              {pro
                ? "See what your logged training changes next."
                : "Adaptive plans, progression insights and your own routine studio."}
            </Txt>
          </View>
          <ArrowUpRight size={19} color={c.green} />
        </Pressable>
      )}
      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        <FadeIn style={{ flex: wide ? 1.8 : undefined }} delay={70}>
          <ImageBackground
            source={require("../../assets/images/training-hero.png")}
            resizeMode="cover"
            imageStyle={{ borderRadius: 24, width: "100%", height: "100%" }}
            style={{
              height: mobile ? 390 : 390,
              borderRadius: 24,
              overflow: "hidden",
              backgroundColor: c.dark,
            }}
          >
            <LinearGradient
              colors={["#15201875", "#132019AC", "#132019F5"]}
              start={{ x: 0.85, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                flex: 1,
                padding: mobile ? 26 : 32,
                justifyContent: "space-between",
              }}
            >
              <View style={u.between}>
                <View
                  style={{
                    backgroundColor: "#FFFFFF20",
                    borderRadius: 40,
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 5,
                      backgroundColor: "#C6DC94",
                    }}
                  />
                  <Eyebrow
                    style={{ fontSize: 9, color: "white", letterSpacing: 1.6 }}
                  >
                    YOUR NEXT SESSION
                  </Eyebrow>
                </View>
                <Txt style={{ color: "#FFFFFFB0", fontSize: 11 }}>
                  01 / YOUR PLAN
                </Txt>
              </View>
              <View style={{ gap: 18 }}>
                <View style={{ gap: 8, maxWidth: 380 }}>
                  <Eyebrow style={{ color: "#DFE7D6", fontSize: 9 }}>
                    {p.goal} · {p.equipment}
                  </Eyebrow>
                  <Txt
                    accessibilityRole="header"
                    style={{
                      fontFamily: f.heavy,
                      fontSize: mobile ? 35 : 43,
                      lineHeight: mobile ? 43 : 51,
                      letterSpacing: -1.4,
                      color: "white",
                    }}
                  >
                    {next.name}
                  </Txt>
                  <Txt style={{ fontSize: 13, color: "#E7E9E1" }}>
                    Show up for yourself. We’ll take it from here.
                  </Txt>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 18,
                  }}
                >
                  <View style={u.row}>
                    <Clock3 size={15} color="#DDE3D4" />
                    <Txt style={{ fontSize: 12, color: "#DDE3D4" }}>
                      {next.minutes} min
                    </Txt>
                  </View>
                  <View
                    style={{
                      width: 1,
                      height: 14,
                      backgroundColor: "#FFFFFF40",
                    }}
                  />
                  <View style={u.row}>
                    <Dumbbell size={16} color="#DDE3D4" />
                    <Txt style={{ fontSize: 12, color: "#DDE3D4" }}>
                      {next.exercises.length} exercises
                    </Txt>
                  </View>
                </View>
                <Button
                  onPress={() => onWorkout(next)}
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: "#F3F2E7",
                    paddingHorizontal: 22,
                  }}
                  icon={<ArrowUpRight size={18} color={c.ink} />}
                >
                  <Txt style={{ fontFamily: f.bold, color: c.ink }}>
                    {state.active
                      ? "Continue your workout"
                      : "Let’s get moving"}
                  </Txt>
                </Button>
              </View>
            </LinearGradient>
          </ImageBackground>
        </FadeIn>
        <FadeIn style={{ flex: wide ? 1 : undefined }} delay={120}>
          <Card style={{ flex: 1, padding: 26, gap: 21, minHeight: 390 }}>
            <View style={u.between}>
              <Txt style={{ fontFamily: f.display, fontSize: 18 }}>
                Your week, in motion.
              </Txt>
              <Flame size={20} color={c.orange} />
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(monday);
                d.setDate(d.getDate() + i);
                const isToday = d.toDateString() === today.toDateString();
                const done = recent.some(
                  (h) =>
                    new Date(h.completedAt).toDateString() === d.toDateString(),
                );
                return (
                  <View key={i} style={{ alignItems: "center", gap: 9 }}>
                    <Txt muted style={{ fontSize: 10 }}>
                      {shortDays[d.getDay()].slice(0, 1)}
                    </Txt>
                    <View
                      style={{
                        height: 32,
                        width: 32,
                        borderRadius: 16,
                        backgroundColor: isToday
                          ? c.ink
                          : done
                            ? c.sage
                            : "transparent",
                        borderWidth: isToday ? 0 : 1,
                        borderColor: p.days.includes(d.getDay())
                          ? c.line
                          : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {done ? (
                        <Check size={14} color={isToday ? "white" : c.green} />
                      ) : (
                        <Txt
                          style={{
                            fontSize: 11,
                            color: isToday ? "white" : c.muted,
                            fontFamily: isToday ? f.bold : f.regular,
                          }}
                        >
                          {d.getDate()}
                        </Txt>
                      )}
                    </View>
                    <View
                      style={{
                        height: 4,
                        width: 4,
                        borderRadius: 2,
                        backgroundColor: p.days.includes(d.getDay())
                          ? c.orange
                          : "transparent",
                      }}
                    />
                  </View>
                );
              })}
            </View>
            <View style={{ height: 1, backgroundColor: c.line }} />
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 22 }}
            >
              <View
                style={{
                  width: 96,
                  height: 96,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Svg width={96} height={96} style={{ position: "absolute" }}>
                  <Circle
                    cx={48}
                    cy={48}
                    r={41}
                    stroke={c.line}
                    strokeWidth={7}
                    fill="none"
                  />
                  <Circle
                    cx={48}
                    cy={48}
                    r={41}
                    stroke={c.orange}
                    strokeWidth={7}
                    fill="none"
                    strokeDasharray={`${Math.max(0.008, completion) * 257.6} 257.6`}
                    strokeLinecap="round"
                    transform="rotate(-90 48 48)"
                  />
                </Svg>
                <Txt
                  style={{
                    fontFamily: f.heavy,
                    fontSize: 26,
                    lineHeight: 32,
                    letterSpacing: -1,
                  }}
                >
                  {doneDays}
                  <Txt style={{ color: c.muted, fontSize: 16 }}>
                    {" "}
                    / {p.days.length}
                  </Txt>
                </Txt>
                <Txt muted style={{ fontSize: 9, lineHeight: 14 }}>
                  training days
                </Txt>
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <Txt style={{ fontFamily: f.bold, fontSize: 15 }}>
                  {doneDays ? "Look at you go." : "Make the first move."}
                </Txt>
                <Txt muted style={{ fontSize: 12, lineHeight: 19 }}>
                  {doneDays
                    ? "Every session is a little promise kept to yourself."
                    : "Progress begins with showing up. Your first session is waiting."}
                </Txt>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onProgress}
              style={[u.between, { paddingTop: 4, minHeight: 36 }]}
            >
              <Txt style={{ fontSize: 12, fontFamily: f.bold }}>
                A closer look at your progress
              </Txt>
              <ArrowRight size={16} color={c.ink} />
            </Pressable>
          </Card>
        </FadeIn>
      </View>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        <View style={{ flex: wide ? 1.8 : undefined }}>
          <SectionTitle
            title="The right kind of extra"
            action="Explore all"
            onPress={onPlan}
          />
          <View style={{ flexDirection: mobile ? "column" : "row", gap: 18 }}>
            {["mobility", "core"].map((id) => (
              <WorkoutCard
                key={id}
                workout={workouts.find((w) => w.id === id)!}
                compact
                onPress={() =>
                  onWorkout(adaptWorkout(workouts.find((w) => w.id === id)!, p))
                }
              />
            ))}
          </View>
        </View>
        <View style={{ flex: wide ? 1 : undefined }}>
          <SectionTitle
            title="Built around you"
            action="Edit"
            onPress={onOnboard}
          />
          <Card
            style={{
              backgroundColor: "#ECEEE4",
              gap: 20,
              borderColor: "#E0E3D4",
              padding: 24,
            }}
          >
            <View style={u.row}>
              <View
                style={{
                  backgroundColor: c.paper,
                  borderRadius: 24,
                  padding: 11,
                }}
              >
                <Sparkles size={20} color={c.green} />
              </View>
              <View>
                <Txt style={{ fontFamily: f.bold, fontSize: 15 }}>
                  A rhythm you can keep.
                </Txt>
                <Txt muted style={{ fontSize: 11 }}>
                  Your plan, your way.
                </Txt>
              </View>
            </View>
            <View style={{ gap: 15 }}>
              {[
                { icon: Target, label: "Your focus", value: p.goal },
                { icon: Dumbbell, label: "Your space", value: p.equipment },
                {
                  icon: Clock3,
                  label: "Your time",
                  value: `${p.days.length} days · ${p.duration} min`,
                },
              ].map(({ icon: Icon, label, value }) => (
                <View key={label} style={u.between}>
                  <View style={u.row}>
                    <Icon size={15} color={c.green} />
                    <Txt muted style={{ fontSize: 12 }}>
                      {label}
                    </Txt>
                  </View>
                  <Txt style={{ fontFamily: f.medium, fontSize: 12 }}>
                    {value}
                  </Txt>
                </View>
              ))}
            </View>
          </Card>
        </View>
      </View>
      <View
        style={{
          paddingTop: 8,
          paddingBottom: 4,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Leaf size={13} color={c.muted} />
        <Txt muted style={{ fontSize: 11 }}>
          Consistency over intensity. Always.
        </Txt>
      </View>
    </View>
  );
}
