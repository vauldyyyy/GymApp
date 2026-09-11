import React, { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Platform,
  Share,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ArrowUpRight,
  Bookmark,
  ChevronRight,
  Cloud,
  Dumbbell,
  Leaf,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  User,
  Wind,
  X,
} from "lucide-react-native";
import { useStore } from "../store";
import { request } from "../lib/api";
import { parseRoutines, routineStorageKey } from "../lib/routines";
import { colors as c, fonts as f } from "../theme";
import { Exercise, Workout } from "../types";
import {
  adaptWorkout,
  buildPlan,
  buildAdaptivePlan,
  exercises,
  shortDays,
  workouts,
} from "../data";
import {
  Button,
  Card,
  Eyebrow,
  SectionTitle,
  Sheet,
  Title,
  Txt,
  styles as u,
} from "../components/UI";
import WorkoutCard from "../components/WorkoutCard";
export function Plan({
  onWorkout,
  onEdit,
  pro = false,
  onCoach,
}: {
  onWorkout: (w: Workout) => void;
  onEdit: () => void;
  pro?: boolean;
  onCoach: () => void;
}) {
  const { state } = useStore();
  const { width } = useWindowDimensions();
  const plan = pro
    ? buildAdaptivePlan(state.profile, state.history).plan
    : buildPlan(state.profile);
  return (
    <View style={{ gap: 28 }}>
      <View style={[u.between, { flexWrap: "wrap" }]}>
        <View style={{ gap: 8, flex: 1, minWidth: 230 }}>
          <Eyebrow style={{ color: c.muted }}>
            A ROUTINE THAT RESPECTS REAL LIFE
          </Eyebrow>
          <Title>Your week. Well planned.</Title>
          <Txt muted>
            {state.profile.goal} · {state.profile.days.length} days a week ·{" "}
            {state.profile.duration} min time budget
          </Txt>
        </View>
        <Button
          kind="light"
          onPress={onEdit}
          icon={<Settings2 size={16} color={c.ink} />}
        >
          Adjust my plan
        </Button>
      </View>
      <Card style={{ backgroundColor: c.dark, padding: 28, borderWidth: 0 }}>
        <View style={[u.between, { flexWrap: "wrap" }]}>
          <View style={{ gap: 9, flex: 1, minWidth: 200 }}>
            <Eyebrow style={{ color: "#C9D6BD" }}>YOUR NORTH STAR</Eyebrow>
            <Txt
              style={{
                fontFamily: f.display,
                fontSize: 24,
                lineHeight: 32,
                color: "white",
              }}
            >
              {pro
                ? "Your completed training shapes what comes next."
                : "A week composed around your choices."}
            </Txt>
            <Txt style={{ fontSize: 13, color: "#CFD7C9", maxWidth: 580 }}>
              {pro
                ? "Your logged exercises and sets inform exercise selection and working volume. Open Coach to see the reasons behind your week."
                : "Your goal, experience, equipment, days and time budget determine the exercises and working sets in this plan."}
            </Txt>
          </View>
          <Target size={62} color="#B7C6A1" strokeWidth={0.85} />
        </View>
      </Card>
      <Pressable
        accessibilityRole="button"
        onPress={onCoach}
        style={{
          flexDirection: "row",
          gap: 10,
          alignItems: "center",
          minHeight: 48,
        }}
      >
        <Sparkles size={19} color={c.orangeDark} />
        <Txt style={{ fontFamily: f.bold, color: c.orangeDark, flex: 1 }}>
          {pro
            ? "Open my coach and routine studio"
            : "Make your next week adaptive with Plus"}
        </Txt>
        <ArrowUpRight size={18} color={c.orangeDark} />
      </Pressable>
      <View style={{ gap: 14 }}>
        {[1, 2, 3, 4, 5, 6, 0].map((day) => {
          const scheduled = plan.find((p) => p.day === day);
          return (
            <Pressable
              key={day}
              accessibilityRole={scheduled ? "button" : undefined}
              disabled={!scheduled}
              onPress={() => scheduled && onWorkout(scheduled.workout)}
              style={({ pressed }) => ({
                padding: width < 700 ? 18 : 24,
                backgroundColor: scheduled ? c.paper : "transparent",
                borderWidth: 1,
                borderColor: scheduled ? c.line : "transparent",
                borderRadius: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: width < 700 ? 12 : 28,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ width: width < 700 ? 35 : 86 }}>
                <Eyebrow
                  style={{
                    color: day === new Date().getDay() ? c.orangeDark : c.muted,
                    fontSize: 10,
                    letterSpacing: 1,
                  }}
                >
                  {shortDays[day]}
                </Eyebrow>
                {day === new Date().getDay() && (
                  <Txt style={{ fontSize: 9, color: c.orangeDark }}>TODAY</Txt>
                )}
              </View>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: scheduled
                    ? scheduled.workout.accent
                    : c.sage,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {scheduled ? (
                  <Dumbbell size={21} color={c.green} />
                ) : (
                  <Leaf size={21} color={c.green} />
                )}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt
                  style={{
                    fontFamily: scheduled ? f.bold : f.medium,
                    fontSize: 14,
                  }}
                >
                  {scheduled?.workout.name || "Room to recover"}
                </Txt>
                <Txt muted style={{ fontSize: 11 }}>
                  {scheduled
                    ? scheduled.workout.minutes +
                      " min · " +
                      scheduled.workout.exercises.length +
                      " exercises"
                    : "Rest, stretch, or take a little walk."}
                </Txt>
              </View>
              {scheduled && <ArrowUpRight size={19} color={c.ink} />}
            </Pressable>
          );
        })}
      </View>
      <Txt muted style={{ fontSize: 12, textAlign: "center" }}>
        Session times are estimates from exercises, sets and rests. Your logged
        weights carry into your next session.
      </Txt>
    </View>
  );
}

export function Explore({
  onWorkout,
  onExercise,
  onSave,
}: {
  onWorkout: (w: Workout) => void;
  onExercise: (e: Exercise) => void;
  onSave: (id: string) => void;
}) {
  const { state } = useStore();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("Workouts");
  const [filter, setFilter] = useState("All");
  const list = workouts.filter(
    (w) =>
      (filter !== "Saved" || state.saved.includes(w.id)) &&
      (filter === "All" || filter === "Saved" || w.category === filter) &&
      (w.name + " " + w.category).toLowerCase().includes(query.toLowerCase()),
  );
  const moves = exercises.filter((e) =>
    (e.name + " " + e.muscle + " " + e.equipment)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <View style={{ gap: 26 }}>
      <View style={{ gap: 8 }}>
        <Eyebrow style={{ color: c.muted }}>FOLLOW YOUR CURIOSITY</Eyebrow>
        <Title>Find your next favorite.</Title>
        <Txt muted>
          Something for your strongest days. And your slower ones.
        </Txt>
      </View>
      <View
        style={{
          flexDirection: width < 700 ? "column" : "row",
          gap: 18,
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            backgroundColor: c.line,
            borderRadius: 30,
            padding: 4,
            alignSelf: "flex-start",
          }}
        >
          {["Workouts", "Exercise guide"].map((label) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === label }}
              onPress={() => setMode(label)}
              style={{
                minHeight: 42,
                paddingHorizontal: 20,
                justifyContent: "center",
                borderRadius: 28,
                backgroundColor: mode === label ? c.paper : "transparent",
              }}
            >
              <Txt
                style={{
                  fontSize: 12,
                  fontFamily: mode === label ? f.bold : f.regular,
                }}
              >
                {label}
              </Txt>
            </Pressable>
          ))}
        </View>
        <View
          style={[
            u.row,
            {
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: 30,
              backgroundColor: c.paper,
              paddingHorizontal: 17,
              minWidth: 260,
            },
          ]}
        >
          <Search size={17} color={c.muted} />
          <TextInput
            accessibilityLabel="Search workouts and exercises"
            placeholder="What moves you?"
            placeholderTextColor={c.muted}
            value={query}
            onChangeText={setQuery}
            style={{
              fontFamily: f.regular,
              fontSize: 13,
              color: c.ink,
              height: 48,
              flex: 1,
            }}
          />
          {!!query && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery("")}
              style={{ padding: 10 }}
            >
              <X size={15} color={c.muted} />
            </Pressable>
          )}
        </View>
      </View>
      {mode === "Workouts" ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 9 }}
          >
            {[
              "All",
              "Strength",
              "Bodyweight",
              "Dumbbells",
              "Core",
              "Mobility",
              "Saved",
            ].map((label) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: filter === label }}
                key={label}
                onPress={() => setFilter(label)}
                style={{
                  borderRadius: 24,
                  paddingHorizontal: 19,
                  minHeight: 42,
                  justifyContent: "center",
                  backgroundColor: filter === label ? c.ink : "transparent",
                  borderWidth: 1,
                  borderColor: filter === label ? c.ink : c.line,
                }}
              >
                <Txt
                  style={{
                    fontSize: 12,
                    color: filter === label ? "white" : c.muted,
                  }}
                >
                  {label}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
            {list.map((w) => (
              <View
                key={w.id}
                style={{
                  width: width < 700 ? "100%" : width < 1200 ? "48%" : "31.7%",
                }}
              >
                <WorkoutCard
                  workout={adaptWorkout(w, state.profile)}
                  onPress={() => onWorkout(adaptWorkout(w, state.profile))}
                  saved={state.saved.includes(w.id)}
                  onSave={() => onSave(w.id)}
                />
              </View>
            ))}
          </View>
          {!list.length && (
            <Card style={{ padding: 40, alignItems: "center", gap: 12 }}>
              <Bookmark size={32} color={c.green} />
              <Txt style={{ fontFamily: f.bold }}>
                {filter === "Saved" && !query.trim()
                  ? "A home for your favorites."
                  : "No matches just yet."}
              </Txt>
              <Txt muted style={{ textAlign: "center" }}>
                {filter === "Saved" && !query.trim()
                  ? "Tap the bookmark on a workout to keep it here."
                  : "Try a different name or category."}
              </Txt>
            </Card>
          )}
          <Txt muted style={{ fontSize: 11 }}>
            Sessions adapt to your equipment and time. Your core training is
            always free.
          </Txt>
        </>
      ) : (
        <View style={{ gap: 12 }}>
          {moves.map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              onPress={() => onExercise(e)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                backgroundColor: c.paper,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: 16,
                padding: 20,
              }}
            >
              <View
                style={{
                  height: 46,
                  width: 46,
                  borderRadius: 14,
                  backgroundColor: c.sage,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {e.muscle === "Mobility" ? (
                  <Wind color={c.green} size={22} />
                ) : (
                  <Dumbbell color={c.green} size={22} />
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt style={{ fontFamily: f.bold }}>{e.name}</Txt>
                <Txt muted style={{ fontSize: 11 }}>
                  {e.muscle} · {e.equipment}
                </Txt>
              </View>
              <ChevronRight size={18} color={c.muted} />
            </Pressable>
          ))}
          {!moves.length && (
            <Txt muted>
              No exercises match that search. Try “legs” or “dumbbell”.
            </Txt>
          )}
        </View>
      )}
    </View>
  );
}

export function ProfileScreen({
  onAccount,
  onPlus,
  onEdit,
  pro,
  preview = false,
  onNotice,
}: {
  onAccount: () => void;
  onPlus: () => void;
  onEdit: () => void;
  pro: boolean;
  preview?: boolean;
  onNotice: (s: string) => void;
}) {
  const store = useStore();
  const { state, auth } = store;
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [actionError, setActionError] = useState("");
  const { width } = useWindowDimensions();
  async function sync() {
    setBusy(true);
    try {
      await store.sync();
      onNotice("All caught up. Your training is synced.");
    } catch (e) {
      store.setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportTraining() {
    setBusy(true);
    try {
      const guestRoutines = auth
        ? null
        : parseRoutines(
            await AsyncStorage.getItem(routineStorageKey(null)),
            null,
          );
      if (!auth && guestRoutines === null)
        throw new Error(
          "Your guest routine library could not be read. It has been kept on this device; resolve the Studio library error before exporting.",
        );
      const data = auth
        ? await request("/api/account/export", { token: auth.token })
        : {
            exportedAt: new Date().toISOString(),
            training: state,
            routines: guestRoutines,
          };
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(
          new Blob([json], { type: "application/json" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download =
          "forma-training-" + new Date().toISOString().slice(0, 10) + ".json";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        await Share.share({ message: json, title: "My FORMA training" });
      }
      onNotice("Your training export is ready.");
    } catch (e) {
      store.setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 28, maxWidth: 850 }}>
      <View style={{ gap: 8 }}>
        <Eyebrow style={{ color: c.muted }}>THIS SPACE IS YOURS</Eyebrow>
        <Title>
          Good to see you
          {state.profile.name ? ", " + state.profile.name.split(" ")[0] : ""}.
        </Title>
        <Txt muted>A few details that make FORMA feel like you.</Txt>
      </View>
      <Card style={{ gap: 22 }}>
        <View style={u.row}>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: c.sage,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <User size={28} color={c.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontFamily: f.display, fontSize: 20 }}>
              {state.profile.name || "Your training profile"}
            </Txt>
            <Txt muted style={{ fontSize: 12 }}>
              {auth?.user.email || "Saved on this device · No account needed"}
            </Txt>
          </View>
        </View>
        <View style={u.divider} />
        {!auth ? (
          <Button
            kind="dark"
            onPress={onAccount}
            icon={<Cloud size={16} color="white" />}
          >
            Create an account or sign in
          </Button>
        ) : (
          <View style={{ gap: 12 }}>
            <Txt muted style={{ fontSize: 12 }}>
              {store.syncStatus}
            </Txt>
            <Button kind="dark" onPress={sync} disabled={busy}>
              {busy ? "Syncing…" : "Sync my training"}
            </Button>
            <Button kind="ghost" onPress={() => setConfirm("signout")}>
              Sign out
            </Button>
          </View>
        )}
      </Card>
      <View style={{ flexDirection: width < 700 ? "column" : "row", gap: 20 }}>
        <Card style={{ flex: 1, gap: 18 }}>
          <SectionTitle title="Your rhythm" action="Edit" onPress={onEdit} />
          {[
            { label: "Focus", value: state.profile.goal },
            { label: "Experience", value: state.profile.experience },
            { label: "Equipment", value: state.profile.equipment },
            {
              label: "Weekly time",
              value:
                state.profile.days.length +
                " × " +
                state.profile.duration +
                " min",
            },
          ].map((x) => (
            <View key={x.label} style={u.between}>
              <Txt muted style={{ fontSize: 12 }}>
                {x.label}
              </Txt>
              <Txt style={{ fontSize: 12, fontFamily: f.medium }}>
                {x.value}
              </Txt>
            </View>
          ))}
        </Card>
        <Card style={{ flex: 1, gap: 18 }}>
          <SectionTitle title="The little details" />
          <Txt muted style={{ fontSize: 12 }}>
            Weight units
          </Txt>
          <View style={u.row}>
            {(["kg", "lb"] as const).map((unit) => (
              <Button
                key={unit}
                kind={state.profile.unit === unit ? "dark" : "light"}
                onPress={() => store.setProfile({ ...state.profile, unit })}
                style={{ flex: 1 }}
              >
                {unit === "kg" ? "Kilograms" : "Pounds"}
              </Button>
            ))}
          </View>
          <Txt muted style={{ fontSize: 11 }}>
            Your previous weights convert automatically. Active sessions keep
            their original unit.
          </Txt>
        </Card>
      </View>
      <Card style={{ backgroundColor: c.sage, gap: 14 }}>
        <View style={[u.between, { flexWrap: "wrap" }]}>
          <View style={u.row}>
            <Sparkles size={22} color={c.green} />
            <Txt style={{ fontFamily: f.bold }}>FORMA Plus</Txt>
          </View>
          <Txt style={{ fontSize: 11 }}>
            {preview
              ? "Local preview · no charge"
              : pro
                ? "Active membership"
                : "Your core training stays free"}
          </Txt>
        </View>
        <Txt muted style={{ fontSize: 13 }}>
          Adaptive weekly planning, progression insights from your logged sets,
          a custom-routine studio and unlimited workout bookmarks.
        </Txt>
        <Button
          kind="dark"
          onPress={onPlus}
          style={{ alignSelf: "flex-start" }}
        >
          {pro ? "View membership" : "Explore membership"}
        </Button>
      </Card>
      <View style={{ gap: 12, paddingVertical: 10 }}>
        <View style={u.row}>
          <ShieldCheck size={17} color={c.green} />
          <Txt style={{ fontFamily: f.bold, fontSize: 13 }}>
            Your training belongs to you.
          </Txt>
        </View>
        <Txt muted style={{ fontSize: 12, lineHeight: 20 }}>
          Your profile, favorites, and workouts are stored on this device. When
          you sign in and sync, a copy is stored in your private account. No
          health-device access is required.
        </Txt>
        <Button
          kind="light"
          onPress={exportTraining}
          disabled={busy}
          style={{ alignSelf: "flex-start" }}
        >
          Export my training
        </Button>
        {auth && (
          <Button
            kind="ghost"
            onPress={() => {
              setDeletePassword("");
              setActionError("");
              setConfirm("delete");
            }}
            style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
          >
            <Txt style={{ color: c.danger, fontSize: 12 }}>
              Delete my account
            </Txt>
          </Button>
        )}
        <Button
          kind="ghost"
          onPress={() => setConfirm("reset")}
          style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
        >
          <Txt style={{ color: c.danger, fontSize: 12 }}>
            Reset my training data
          </Txt>
        </Button>
        <Txt muted style={{ fontSize: 10 }}>
          FORMA 1.0 · Made for your momentum
        </Txt>
      </View>
      <Sheet
        visible={!!confirm}
        onClose={() => setConfirm("")}
        title={
          confirm === "delete"
            ? "Delete your account?"
            : confirm === "reset"
              ? "Start with a clean slate?"
              : "Sign out of FORMA?"
        }
      >
        <Txt>
          {confirm === "delete"
            ? "This permanently deletes your account and synced training. Your app-store subscription must be cancelled separately in your Apple or Google account. Enter your password to confirm."
            : confirm === "reset"
              ? "This permanently clears your profile, workout history, favorites, and active session from this device and your connected account. Your custom routine library is kept."
              : "Your training stays saved in your private account cache. Any pending changes sync when you sign back in."}
        </Txt>
        {confirm === "delete" && (
          <View>
            <Txt style={u.label}>Current password</Txt>
            <TextInput
              accessibilityLabel="Confirm account password"
              secureTextEntry
              autoComplete="current-password"
              value={deletePassword}
              onChangeText={setDeletePassword}
              style={u.input}
            />
          </View>
        )}
        {!!actionError && (
          <Txt
            accessibilityRole="alert"
            style={{ color: c.danger, fontSize: 12 }}
          >
            {actionError}
          </Txt>
        )}
        <Button
          kind="dark"
          disabled={busy || (confirm === "delete" && !deletePassword)}
          onPress={async () => {
            setBusy(true);
            try {
              if (confirm === "delete")
                await store.deleteAccount(deletePassword);
              else if (confirm === "reset") await store.reset();
              else await store.signOut();
              setConfirm("");
              onNotice(
                confirm === "delete"
                  ? "Your account has been deleted."
                  : confirm === "reset"
                    ? "Your training data has been reset."
                    : "You’re signed out.",
              );
            } catch (e) {
              setActionError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "One moment…"
            : confirm === "delete"
              ? "Permanently delete account"
              : confirm === "reset"
                ? "Reset training data"
                : "Sign out"}
        </Button>
        <Button kind="light" onPress={() => setConfirm("")}>
          Keep things as they are
        </Button>
      </Sheet>
    </View>
  );
}
