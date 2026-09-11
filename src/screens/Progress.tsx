import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Dumbbell,
  Leaf,
  Sparkles,
  Trophy,
} from "lucide-react-native";
import { useStore } from "../store";
import { exercises, weekStart } from "../data";
import { colors as c, fonts as f } from "../theme";
import {
  Card,
  Eyebrow,
  FadeIn,
  SectionTitle,
  Sheet,
  Title,
  Txt,
} from "../components/UI";
import type { LoggedSet, WorkoutRecord } from "../types";

type Metric = "sessions" | "volume";
type WeekData = { start: Date; sessions: number; volume: number };
type PersonalRecord = {
  exerciseId: string;
  kilograms: number;
  reps: number;
  completedAt: string;
};
const KG_PER_LB = 0.45359237;
const positive = (value: number | undefined) =>
  Number.isFinite(value) && (value ?? 0) > 0 ? (value as number) : 0;
const completedSets = (record: WorkoutRecord): LoggedSet[] =>
  (record.sets ?? []).filter((set) => set.done && positive(set.reps) > 0);
const kilograms = (weight: number, unit: "kg" | "lb") =>
  positive(weight) * (unit === "lb" ? KG_PER_LB : 1);
const convert = (weightKg: number, unit: "kg" | "lb") =>
  weightKg / (unit === "lb" ? KG_PER_LB : 1);
const recordVolumeKg = (record: WorkoutRecord) =>
  completedSets(record).reduce(
    (sum, set) => sum + positive(set.reps) * kilograms(set.weight, record.unit),
    0,
  );
const number = (value: number, digits = 0) =>
  value.toLocaleString(undefined, { maximumFractionDigits: digits });
const compact = (value: number) =>
  value >= 1000000
    ? `${number(value / 1000000, 1)}m`
    : value >= 1000
      ? `${number(value / 1000, 1)}k`
      : number(value, value < 10 && !Number.isInteger(value) ? 1 : 0);
const exerciseName = (id: string) =>
  exercises.find((exercise) => exercise.id === id)?.name ?? "Saved exercise";
const dateLabel = (value: string, withYear = false) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(withYear ? { year: "numeric" as const } : {}),
      })
    : "Date unavailable";
};
const durationLabel = (seconds: number) => {
  const total = Math.floor(positive(seconds));
  const minutes = Math.floor(total / 60);
  return minutes > 0 ? `${minutes}m ${total % 60}s` : `${total}s`;
};

function WeeklyChart({
  weeks,
  metric,
  unit,
}: {
  weeks: WeekData[];
  metric: Metric;
  unit: "kg" | "lb";
}) {
  const [width, setWidth] = useState(500);
  const values = weeks.map((week) =>
    metric === "sessions" ? week.sessions : convert(week.volume, unit),
  );
  const max = Math.max(0, ...values);
  const step = max === 0 ? 1 : Math.pow(10, Math.floor(Math.log10(max / 3)));
  const scaleMax =
    max === 0
      ? metric === "sessions"
        ? 4
        : 100
      : Math.ceil(max / step) * step;
  const left = 43,
    right = 9,
    top = 27,
    baseline = 177;
  const plotWidth = Math.max(100, width - left - right);
  const pitch = plotWidth / Math.max(weeks.length, 1);
  const barWidth = Math.max(5, Math.min(31, pitch * 0.53));
  const summary = weeks
    .map(
      (week, index) =>
        `${week.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${number(values[index] ?? 0, metric === "volume" ? 1 : 0)} ${metric === "sessions" ? "sessions" : unit}`,
    )
    .join("; ");
  return (
    <View
      onLayout={(event) =>
        setWidth(Math.max(180, event.nativeEvent.layout.width))
      }
    >
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Weekly ${metric === "sessions" ? "sessions" : `logged volume in ${unit}`}. ${summary}`}
      >
        <Svg
          width="100%"
          height={220}
          viewBox={`0 0 ${width} 220`}
          aria-hidden={true}
        >
          {[0, 0.5, 1].map((fraction) => {
            const y = baseline - fraction * (baseline - top);
            return (
              <React.Fragment key={fraction}>
                <Line
                  x1={left}
                  y1={y}
                  x2={width - right}
                  y2={y}
                  stroke={c.line}
                  strokeWidth={1}
                  strokeDasharray={fraction === 0 ? undefined : "3 5"}
                />
                <SvgText
                  x={left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontFamily={f.regular}
                  fontSize={10}
                  fill={c.muted}
                >
                  {metric === "sessions" &&
                  !Number.isInteger(scaleMax * fraction)
                    ? ""
                    : compact(scaleMax * fraction)}
                </SvgText>
              </React.Fragment>
            );
          })}
          {weeks.map((week, index) => {
            const value = values[index] ?? 0;
            const height = (value / scaleMax) * (baseline - top);
            const center = left + pitch * (index + 0.5);
            const isCurrent = index === weeks.length - 1;
            return (
              <React.Fragment key={week.start.toISOString()}>
                {value > 0 && (
                  <Rect
                    x={center - barWidth / 2}
                    y={baseline - height}
                    width={barWidth}
                    height={height}
                    rx={Math.min(5, height / 2)}
                    fill={isCurrent ? c.orangeDark : c.green}
                  />
                )}
                <SvgText
                  x={center}
                  y={value > 0 ? baseline - height - 9 : baseline - 9}
                  textAnchor="middle"
                  fontFamily={f.bold}
                  fontSize={10}
                  fill={value > 0 ? c.ink : c.muted}
                >
                  {compact(value)}
                </SvgText>
                <SvgText
                  x={center}
                  y={baseline + 21}
                  textAnchor="middle"
                  fontFamily={isCurrent ? f.bold : f.regular}
                  fontSize={width < 340 ? 8 : 10}
                  fill={isCurrent ? c.ink : c.muted}
                >
                  {week.start.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </SvgText>
                {isCurrent && (
                  <Rect
                    x={center - 2}
                    y={baseline + 30}
                    width={4}
                    height={4}
                    rx={2}
                    fill={c.orangeDark}
                  />
                )}
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
      <View style={styles.chartCaption}>
        <Txt muted style={styles.smallText}>
          Weeks beginning Monday
        </Txt>
        <View style={styles.captionKey}>
          <View style={styles.currentDot} />
          <Txt muted style={styles.smallText}>
            Current week
          </Txt>
        </View>
      </View>
    </View>
  );
}

export default function Progress() {
  const { state } = useStore();
  const { width } = useWindowDimensions();
  const mobile = width < 700;
  const wide = width >= 1180;
  const unit = state.profile?.unit === "lb" ? "lb" : "kg";
  const [metric, setMetric] = useState<Metric>("sessions");
  const [selected, setSelected] = useState<WorkoutRecord | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const history = useMemo(
    () =>
      [...(state.history ?? [])].sort(
        (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt),
      ),
    [state.history],
  );
  const totalSeconds = history.reduce(
    (total, record) => total + positive(record.durationSeconds),
    0,
  );
  const totalVolume = convert(
    history.reduce((total, record) => total + recordVolumeKg(record), 0),
    unit,
  );
  const totalSets = history.reduce(
    (total, record) => total + completedSets(record).length,
    0,
  );
  const currentMonday = weekStart();
  const weeks: WeekData[] = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(currentMonday);
    start.setDate(start.getDate() - (7 - index) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const records = history.filter((record) => {
      const time = Date.parse(record.completedAt);
      return time >= start.getTime() && time < end.getTime();
    });
    return {
      start,
      sessions: records.length,
      volume: records.reduce(
        (total, record) => total + recordVolumeKg(record),
        0,
      ),
    };
  });
  const eightWeekSessions = weeks.reduce(
    (total, week) => total + week.sessions,
    0,
  );
  const eightWeekVolume = convert(
    weeks.reduce((total, week) => total + week.volume, 0),
    unit,
  );
  const personalRecords = useMemo(() => {
    const best = new Map<string, PersonalRecord>();
    for (const record of history) {
      for (const set of completedSets(record)) {
        const weight = kilograms(set.weight, record.unit);
        if (weight <= 0) continue;
        const existing = best.get(set.exerciseId);
        if (!existing || weight > existing.kilograms)
          best.set(set.exerciseId, {
            exerciseId: set.exerciseId,
            kilograms: weight,
            reps: set.reps,
            completedAt: record.completedAt,
          });
      }
    }
    return [...best.values()].sort(
      (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt),
    );
  }, [history]);
  const visibleHistory = showAllHistory ? history : history.slice(0, 5);
  const visibleRecords = showAllRecords
    ? personalRecords
    : personalRecords.slice(0, 5);
  const detailSets = selected ? completedSets(selected) : [];
  const detailExercises = [...new Set(detailSets.map((set) => set.exerciseId))];

  return (
    <View style={styles.page}>
      <FadeIn>
        <View style={styles.headingRow}>
          <View style={styles.headingText}>
            <Eyebrow style={{ color: c.muted }}>
              YOUR EFFORT, MADE VISIBLE
            </Eyebrow>
            <Title
              style={{
                fontSize: mobile ? 32 : 42,
                lineHeight: mobile ? 40 : 53,
              }}
            >
              Look how far you’ve come.
            </Title>
            <Txt muted>
              {history.length
                ? "Every session adds up. Here’s a little perspective on your progress."
                : "Your progress starts with showing up. We’ll keep the story as you go."}
            </Txt>
          </View>
          {!mobile && (
            <View style={styles.allTimePill}>
              <CalendarDays size={16} color={c.green} aria-hidden={true} />
              <Txt style={styles.pillText}>Your training story</Txt>
            </View>
          )}
        </View>
      </FadeIn>

      <FadeIn delay={50}>
        <View style={[styles.stats, mobile && styles.statsMobile]}>
          {[
            {
              label: "Sessions completed",
              value: number(history.length),
              unit: "",
              icon: Check,
              detail: "Every time you showed up",
              color: c.sage,
            },
            {
              label: "Time for yourself",
              value: number(totalSeconds / 60, 1),
              unit: "min",
              icon: Clock3,
              detail: "Total recorded session time",
              color: c.cream,
            },
            {
              label: "Total logged volume",
              value: number(totalVolume, 1),
              unit,
              icon: Dumbbell,
              detail: "Completed weight × reps",
              color: c.paleOrange,
            },
          ].map(({ label, value, unit: suffix, icon: Icon, detail, color }) => (
            <Card key={label} style={mobile ? styles.statMobile : styles.stat}>
              <View style={styles.statTop}>
                <Txt style={styles.statLabel}>{label}</Txt>
                <View style={[styles.statIcon, { backgroundColor: color }]}>
                  <Icon size={19} color={c.ink} aria-hidden={true} />
                </View>
              </View>
              <View style={styles.statValueRow}>
                <Txt style={styles.statValue}>{value}</Txt>
                {suffix !== "" && (
                  <Txt muted style={styles.statUnit}>
                    {suffix}
                  </Txt>
                )}
              </View>
              <Txt muted style={styles.statDetail}>
                {detail}
              </Txt>
            </Card>
          ))}
        </View>
      </FadeIn>

      <View
        style={[styles.mainRow, { flexDirection: wide ? "row" : "column" }]}
      >
        <View style={{ flex: wide ? 1.65 : undefined, minWidth: 0, gap: 28 }}>
          <FadeIn delay={90}>
            <Card style={{ padding: mobile ? 18 : 26 }}>
              <View
                style={[
                  styles.chartHeader,
                  mobile && { alignItems: "flex-start" },
                ]}
              >
                <View style={{ flex: 1, gap: 5 }}>
                  <Txt accessibilityRole="header" style={styles.cardTitle}>
                    A rhythm taking shape.
                  </Txt>
                  <Txt muted style={styles.smallText}>
                    Last 8 weeks · including this week
                  </Txt>
                </View>
                <View style={styles.metricToggle}>
                  {(["sessions", "volume"] as const).map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setMetric(value)}
                      accessibilityRole="button"
                      accessibilityLabel={`Show weekly ${value}`}
                      accessibilityState={{ selected: metric === value }}
                      style={({ pressed }) => [
                        styles.metricButton,
                        metric === value && styles.metricSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Txt
                        style={[
                          styles.metricText,
                          metric === value && { color: c.paper },
                        ]}
                      >
                        {value === "sessions" ? "Sessions" : "Volume"}
                      </Txt>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.chartTotalRow}>
                <Txt style={styles.chartTotal}>
                  {number(
                    metric === "sessions" ? eightWeekSessions : eightWeekVolume,
                    metric === "sessions" ? 0 : 1,
                  )}
                </Txt>
                <Txt muted style={styles.chartTotalUnit}>
                  {metric === "sessions"
                    ? `session${eightWeekSessions === 1 ? "" : "s"}`
                    : `${unit} logged`}
                </Txt>
              </View>
              <WeeklyChart weeks={weeks} metric={metric} unit={unit} />
              {(metric === "sessions"
                ? eightWeekSessions === 0
                : eightWeekVolume === 0) && (
                <View style={styles.chartEmptyNote}>
                  <Leaf size={18} color={c.green} aria-hidden={true} />
                  <Txt style={styles.chartEmptyText}>
                    {metric === "volume" && eightWeekSessions > 0
                      ? "No added weight logged in this period. Your sessions still count."
                      : "Room for your next chapter. A completed workout will appear here."}
                  </Txt>
                </View>
              )}
              <Txt muted style={styles.volumeNote}>
                {metric === "volume"
                  ? `Volume uses completed sets, converted to ${unit}. Body weight itself is not included.`
                  : "Each bar shows completed sessions in that week. Rest days are part of the rhythm."}
              </Txt>
            </Card>
          </FadeIn>

          <View>
            <SectionTitle title="Your training journal" />
            {history.length === 0 ? (
              <Card style={styles.historyEmpty}>
                <View style={styles.emptyIcon}>
                  <CalendarDays
                    size={26}
                    color={c.green}
                    strokeWidth={1.6}
                    aria-hidden={true}
                  />
                </View>
                <Txt style={styles.emptyTitle}>
                  One session. A new beginning.
                </Txt>
                <Txt muted style={styles.emptyDescription}>
                  Finish your first workout from Today or your plan. Your
                  exercises, sets and effort will have a home right here.
                </Txt>
                <View style={styles.emptyFoot}>
                  <View style={styles.currentDot} />
                  <Txt style={styles.emptyFootText}>
                    PROGRESS AT YOUR OWN PACE
                  </Txt>
                </View>
              </Card>
            ) : (
              <View style={{ gap: 12 }}>
                {visibleHistory.map((record) => {
                  const completed = completedSets(record).length;
                  const volume = convert(recordVolumeKg(record), unit);
                  return (
                    <Pressable
                      key={record.id}
                      onPress={() => setSelected(record)}
                      accessibilityRole="button"
                      accessibilityLabel={`${record.name}, ${dateLabel(record.completedAt, true)}, ${completed} completed sets. View workout details.`}
                      style={({ pressed }) => [
                        styles.historyCard,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.historyDate}>
                        <Txt style={styles.historyDay}>
                          {Number.isFinite(Date.parse(record.completedAt))
                            ? new Date(record.completedAt).getDate()
                            : "—"}
                        </Txt>
                        <Txt style={styles.historyMonth}>
                          {Number.isFinite(Date.parse(record.completedAt))
                            ? new Date(record.completedAt)
                                .toLocaleDateString("en-US", { month: "short" })
                                .toUpperCase()
                            : ""}
                        </Txt>
                      </View>
                      <View style={styles.historyInfo}>
                        <Txt style={styles.historyName}>
                          {record.name || "Workout session"}
                        </Txt>
                        <Txt muted style={styles.historyMeta}>
                          {completed} sets ·{" "}
                          {durationLabel(record.durationSeconds)} ·{" "}
                          {number(volume, 1)} {unit}
                        </Txt>
                        <Txt muted style={styles.historyYear}>
                          {dateLabel(record.completedAt, true)}
                        </Txt>
                      </View>
                      <ArrowUpRight
                        size={19}
                        color={c.ink}
                        aria-hidden={true}
                      />
                    </Pressable>
                  );
                })}
                {history.length > 5 && (
                  <Pressable
                    onPress={() => setShowAllHistory((value) => !value)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showAllHistory }}
                    style={({ pressed }) => [
                      styles.moreButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Txt style={styles.moreText}>
                      {showAllHistory
                        ? "Show recent sessions"
                        : `View all ${history.length} sessions`}
                    </Txt>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 24 }}>
          <FadeIn delay={140}>
            <Card style={{ padding: mobile ? 22 : 26 }}>
              <View style={styles.recordsHeader}>
                <View style={styles.trophyIcon}>
                  <Trophy
                    size={22}
                    color={c.orangeDark}
                    strokeWidth={1.7}
                    aria-hidden={true}
                  />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt accessibilityRole="header" style={styles.cardTitle}>
                    Little personal bests.
                  </Txt>
                  <Txt muted style={styles.smallText}>
                    Heaviest completed set · all time
                  </Txt>
                </View>
              </View>
              {personalRecords.length === 0 ? (
                <View style={styles.recordsEmpty}>
                  <Txt style={styles.recordsEmptyTitle}>
                    Your first best is waiting.
                  </Txt>
                  <Txt muted style={styles.recordsEmptyText}>
                    Log a completed set with added weight to see your heaviest
                    lifts here. Every kind of movement still counts.
                  </Txt>
                  <View style={styles.recordPlaceholder}>
                    <View style={styles.placeholderLine} />
                    <Trophy size={18} color={c.line} aria-hidden={true} />
                    <View style={styles.placeholderLine} />
                  </View>
                </View>
              ) : (
                <View style={styles.recordList}>
                  {visibleRecords.map((record) => (
                    <View key={record.exerciseId} style={styles.recordRow}>
                      <View style={{ flex: 1, gap: 5 }}>
                        <Txt style={styles.recordName}>
                          {exerciseName(record.exerciseId)}
                        </Txt>
                        <Txt muted style={styles.recordDate}>
                          {record.reps} reps ·{" "}
                          {dateLabel(record.completedAt, true)}
                        </Txt>
                      </View>
                      <View style={styles.recordWeight}>
                        <Txt style={styles.recordWeightValue}>
                          {number(convert(record.kilograms, unit), 1)}
                        </Txt>
                        <Txt muted style={styles.recordUnit}>
                          {unit}
                        </Txt>
                      </View>
                    </View>
                  ))}
                  {personalRecords.length > 5 && (
                    <Pressable
                      onPress={() => setShowAllRecords((value) => !value)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showAllRecords }}
                      style={({ pressed }) => [
                        styles.moreButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Txt style={styles.moreText}>
                        {showAllRecords
                          ? "Show recent records"
                          : `See all ${personalRecords.length} records`}
                      </Txt>
                    </Pressable>
                  )}
                </View>
              )}
              <Txt muted style={styles.recordsFootnote}>
                Actual weights you logged, shown in {unit}. These are not
                estimated one-rep maxes.
              </Txt>
            </Card>
          </FadeIn>
          <Card style={styles.perspectiveCard}>
            <Sparkles
              size={23}
              color={c.green}
              strokeWidth={1.7}
              aria-hidden={true}
            />
            <Txt style={styles.perspectiveTitle}>
              {history.length
                ? "The little things add up."
                : "There’s more than one way to make progress."}
            </Txt>
            <Txt style={styles.perspectiveBody}>
              {history.length
                ? `${number(totalSets)} completed ${totalSets === 1 ? "set" : "sets"}. ${number(history.length)} ${history.length === 1 ? "session" : "sessions"} you made time for. Your consistency is worth noticing.`
                : "A more comfortable movement. A session you made time for. A little more confidence. Your numbers are only part of your story."}
            </Txt>
            <Eyebrow style={{ color: c.green, fontSize: 9, marginTop: 6 }}>
              YOUR PACE. YOUR PROGRESS.
            </Eyebrow>
          </Card>
        </View>
      </View>

      <Sheet
        visible={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name || "Workout details"}
      >
        {selected && (
          <>
            <View style={styles.detailBadge}>
              <Check size={14} color={c.green} aria-hidden={true} />
              <Txt style={styles.detailBadgeText}>
                COMPLETED · {dateLabel(selected.completedAt, true)}
              </Txt>
            </View>
            <View style={styles.detailStats}>
              <View>
                <Txt style={styles.detailNumber}>{detailSets.length}</Txt>
                <Txt muted style={styles.smallText}>
                  completed sets
                </Txt>
              </View>
              <View>
                <Txt style={styles.detailNumber}>
                  {durationLabel(selected.durationSeconds)}
                </Txt>
                <Txt muted style={styles.smallText}>
                  session time
                </Txt>
              </View>
              <View>
                <Txt style={styles.detailNumber}>
                  {number(convert(recordVolumeKg(selected), unit), 1)} {unit}
                </Txt>
                <Txt muted style={styles.smallText}>
                  logged volume
                </Txt>
              </View>
            </View>
            <View style={{ gap: 18 }}>
              {detailExercises.map((id) => (
                <View key={id} style={styles.detailExercise}>
                  <Txt style={styles.detailExerciseName}>
                    {exerciseName(id)}
                  </Txt>
                  {detailSets
                    .filter((set) => set.exerciseId === id)
                    .sort((a, b) => a.index - b.index)
                    .map((set, index) => (
                      <View
                        key={`${id}-${set.index}-${index}`}
                        style={styles.setRow}
                      >
                        <View style={styles.setNumber}>
                          <Txt style={styles.setNumberText}>
                            {set.index + 1}
                          </Txt>
                        </View>
                        <Txt style={styles.setReps}>{set.reps} reps</Txt>
                        <Txt style={styles.setWeight}>
                          {positive(set.weight) > 0
                            ? `${number(convert(kilograms(set.weight, selected.unit), unit), 1)} ${unit}`
                            : "No added weight"}
                        </Txt>
                        <Check size={16} color={c.green} aria-hidden={true} />
                      </View>
                    ))}
                </View>
              ))}
            </View>
            {(selected.sets?.length ?? 0) > detailSets.length && (
              <Txt muted style={styles.smallText}>
                {(selected.sets?.length ?? 0) - detailSets.length} unfinished{" "}
                {(selected.sets?.length ?? 0) - detailSets.length === 1
                  ? "set was"
                  : "sets were"}{" "}
                excluded from these totals.
              </Txt>
            )}
            <Txt muted style={styles.detailFootnote}>
              Completed sets are shown in your preferred unit ({unit}). Volume
              is logged weight multiplied by repetitions; body weight itself is
              excluded.
            </Txt>
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 28 },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 20,
  },
  headingText: { flex: 1, gap: 8 },
  allTimePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: c.line,
  },
  pillText: { fontFamily: f.medium, fontSize: 12 },
  stats: { flexDirection: "row", gap: 18 },
  statsMobile: { flexDirection: "column", gap: 12 },
  stat: { flex: 1, padding: 23, minWidth: 0 },
  statMobile: { padding: 20 },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  statLabel: { fontFamily: f.medium, fontSize: 13, lineHeight: 20, flex: 1 },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 18,
  },
  statValue: {
    fontFamily: f.heavy,
    fontSize: 37,
    lineHeight: 45,
    letterSpacing: -1.3,
  },
  statUnit: { fontFamily: f.medium, fontSize: 15 },
  statDetail: { fontSize: 11, lineHeight: 18, marginTop: 5 },
  mainRow: { gap: 24, alignItems: "stretch" },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 18,
  },
  cardTitle: {
    fontFamily: f.display,
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  smallText: { fontSize: 11, lineHeight: 18 },
  metricToggle: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 30,
    backgroundColor: c.bg,
  },
  metricButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  metricSelected: { backgroundColor: c.ink },
  metricText: {
    fontFamily: f.bold,
    fontSize: 11,
    lineHeight: 18,
    color: c.muted,
  },
  chartTotalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 24,
    marginBottom: 10,
  },
  chartTotal: {
    fontFamily: f.heavy,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -1.2,
  },
  chartTotalUnit: { fontSize: 13 },
  chartCaption: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  captionKey: { flexDirection: "row", alignItems: "center", gap: 6 },
  currentDot: {
    height: 6,
    width: 6,
    borderRadius: 4,
    backgroundColor: c.orangeDark,
  },
  chartEmptyNote: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: c.sage,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  chartEmptyText: { flex: 1, fontSize: 12, lineHeight: 19, color: c.green },
  volumeNote: { fontSize: 10, lineHeight: 17, marginTop: 17 },
  historyEmpty: {
    alignItems: "center",
    paddingHorizontal: 30,
    paddingVertical: 36,
  },
  emptyIcon: {
    backgroundColor: c.sage,
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  emptyTitle: {
    fontFamily: f.display,
    fontSize: 21,
    lineHeight: 29,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  emptyDescription: {
    textAlign: "center",
    maxWidth: 365,
    fontSize: 13,
    lineHeight: 22,
    marginTop: 11,
  },
  emptyFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 26,
  },
  emptyFootText: {
    fontFamily: f.bold,
    fontSize: 8,
    lineHeight: 15,
    letterSpacing: 1.5,
    color: c.muted,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    padding: 18,
    backgroundColor: c.paper,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 17,
  },
  historyDate: {
    width: 49,
    minHeight: 59,
    backgroundColor: c.bg,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  historyDay: { fontFamily: f.heavy, fontSize: 21, lineHeight: 27 },
  historyMonth: {
    fontFamily: f.bold,
    fontSize: 8,
    lineHeight: 14,
    letterSpacing: 1,
    color: c.muted,
  },
  historyInfo: { flex: 1, minWidth: 0, gap: 4 },
  historyName: { fontFamily: f.bold, fontSize: 14, lineHeight: 21 },
  historyMeta: { fontSize: 11, lineHeight: 18 },
  historyYear: { fontSize: 10, lineHeight: 15 },
  moreButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginTop: 4,
  },
  moreText: { fontFamily: f.bold, fontSize: 12, lineHeight: 18 },
  recordsHeader: { flexDirection: "row", alignItems: "center", gap: 13 },
  trophyIcon: {
    width: 46,
    height: 46,
    backgroundColor: c.paleOrange,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  recordsEmpty: { paddingTop: 30, paddingBottom: 13 },
  recordsEmptyTitle: {
    fontFamily: f.display,
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  recordsEmptyText: { fontSize: 13, lineHeight: 22, marginTop: 10 },
  recordPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginVertical: 27,
  },
  placeholderLine: { flex: 1, height: 1, backgroundColor: c.line },
  recordList: { marginTop: 22 },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  recordName: { fontFamily: f.bold, fontSize: 13, lineHeight: 20 },
  recordDate: { fontSize: 10, lineHeight: 17 },
  recordWeight: { alignItems: "flex-end" },
  recordWeightValue: {
    fontFamily: f.heavy,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.6,
  },
  recordUnit: { fontSize: 10, lineHeight: 15 },
  recordsFootnote: { fontSize: 10, lineHeight: 17, marginTop: 16 },
  perspectiveCard: {
    backgroundColor: c.sage,
    borderColor: c.sage,
    padding: 26,
    gap: 15,
  },
  perspectiveTitle: {
    fontFamily: f.display,
    fontSize: 23,
    lineHeight: 31,
    letterSpacing: -0.6,
    color: c.green,
  },
  perspectiveBody: { fontSize: 13, lineHeight: 23, color: c.green },
  detailBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: c.sage,
  },
  detailBadgeText: {
    fontFamily: f.bold,
    fontSize: 9,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: c.green,
  },
  detailStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 20,
    paddingVertical: 12,
  },
  detailNumber: {
    fontFamily: f.heavy,
    fontSize: 22,
    lineHeight: 31,
    letterSpacing: -0.5,
  },
  detailExercise: {
    borderRadius: 16,
    backgroundColor: c.paper,
    borderWidth: 1,
    borderColor: c.line,
    padding: 17,
  },
  detailExerciseName: {
    fontFamily: f.bold,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 15,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  setNumber: {
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor: c.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  setNumberText: {
    fontFamily: f.bold,
    fontSize: 10,
    lineHeight: 16,
    color: c.muted,
  },
  setReps: { flex: 1, fontFamily: f.medium, fontSize: 12, lineHeight: 19 },
  setWeight: {
    flex: 1,
    fontFamily: f.medium,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "right",
  },
  detailFootnote: { fontSize: 11, lineHeight: 19 },
  pressed: { opacity: 0.65 },
});
