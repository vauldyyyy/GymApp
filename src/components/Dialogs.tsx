import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { CheckCircle2, ChevronRight, Leaf, Play } from "lucide-react-native";
import { useStore } from "../store";
import { colors as c, fonts as f } from "../theme";
import { Exercise, Workout, WorkoutRecord } from "../types";
import { exerciseById } from "../data";
import { Button, Card, Eyebrow, Sheet, Title, Txt, styles as u } from "./UI";
export function WorkoutDetails({
  workout,
  onClose,
  onExercise,
  onStart,
}: {
  workout: Workout | null;
  onClose: () => void;
  onExercise: (e: Exercise) => void;
  onStart: () => void;
}) {
  const { state } = useStore();
  const equipmentUsed = workout
    ? [
        ...new Set(
          workout.exercises
            .map((id) => exerciseById(id).equipment)
            .filter((equipment) => equipment !== "Any"),
        ),
      ]
    : [];
  const equipmentLabel = equipmentUsed.includes("Full gym")
    ? "Full gym"
    : equipmentUsed.length
      ? equipmentUsed.join(" + ")
      : "Bodyweight";
  return (
    <Sheet
      visible={!!workout}
      onClose={onClose}
      title="Your next good decision"
      wide
    >
      <View style={{ gap: 22 }}>
        {workout && (
          <>
            <View
              style={{
                padding: 28,
                borderRadius: 20,
                backgroundColor: workout.accent,
                gap: 12,
              }}
            >
              <Eyebrow style={{ color: c.green }}>
                {workout.category} · {workout.minutes} MINUTES
              </Eyebrow>
              <Title>{workout.name}</Title>
              <Txt style={{ color: c.green }}>{workout.subtitle}</Txt>
            </View>
            <View style={[u.row, { gap: 20, flexWrap: "wrap" }]}>
              <Txt muted style={{ fontSize: 12 }}>
                {workout.exercises.length} exercises
              </Txt>
              <Txt muted style={{ fontSize: 12 }}>
                {workout.exercises.reduce(
                  (total, id) =>
                    total +
                    (workout.prescription?.find(
                      (item) => item.exerciseId === id,
                    )?.sets ??
                      Math.min(
                        exerciseById(id).sets,
                        state.profile.experience === "Getting started" ? 2 : 3,
                      )),
                  0,
                )}{" "}
                working sets
              </Txt>
              <Txt muted style={{ fontSize: 12 }}>
                {equipmentLabel}
              </Txt>
            </View>
            <View>
              {workout.exercises.map((id, index) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  onPress={() => onExercise(exerciseById(id))}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: c.line,
                    gap: 16,
                  }}
                >
                  <Txt muted style={{ fontSize: 12, width: 25 }}>
                    {String(index + 1).padStart(2, "0")}
                  </Txt>
                  <View style={{ flex: 1 }}>
                    <Txt style={{ fontFamily: f.bold }}>
                      {exerciseById(id).name}
                    </Txt>
                    <Txt muted style={{ fontSize: 11 }}>
                      {exerciseById(id).muscle} ·{" "}
                      {workout.prescription?.find(
                        (item) => item.exerciseId === id,
                      )?.sets ??
                        Math.min(
                          exerciseById(id).sets,
                          state.profile.experience === "Getting started"
                            ? 2
                            : 3,
                        )}{" "}
                      sets ×{" "}
                      {workout.prescription?.find(
                        (item) => item.exerciseId === id,
                      )?.reps ?? exerciseById(id).reps}{" "}
                      reps ·{" "}
                      {workout.prescription?.find(
                        (item) => item.exerciseId === id,
                      )?.restSeconds ?? exerciseById(id).rest}
                      s rest
                    </Txt>
                  </View>
                  <ChevronRight size={17} color={c.muted} />
                </Pressable>
              ))}
            </View>
            <Txt muted style={{ fontSize: 12 }}>
              Start with a few easy warm-up sets. Choose weights you can control
              and leave a little in the tank.
            </Txt>
            <Button onPress={onStart} icon={<Play size={16} color="white" />}>
              Start workout
            </Button>
          </>
        )}
      </View>
    </Sheet>
  );
}
export function ExerciseDetails({
  exercise,
  onClose,
}: {
  exercise: Exercise | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      visible={!!exercise}
      onClose={onClose}
      title={exercise?.name || "Exercise guide"}
    >
      {exercise && (
        <>
          <View style={[u.row, { gap: 8, flexWrap: "wrap" }]}>
            <View style={u.pill}>
              <Txt style={{ fontSize: 11 }}>{exercise.muscle}</Txt>
            </View>
            <View style={u.pill}>
              <Txt style={{ fontSize: 11 }}>{exercise.equipment}</Txt>
            </View>
            <Txt muted style={{ fontSize: 11 }}>
              {exercise.rest}s rest
            </Txt>
          </View>
          {exercise.instructions.map((text, i) => (
            <View key={text} style={{ flexDirection: "row", gap: 16 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: c.sage,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Txt style={{ fontFamily: f.bold, fontSize: 12 }}>{i + 1}</Txt>
              </View>
              <Txt style={{ flex: 1, lineHeight: 23 }}>{text}</Txt>
            </View>
          ))}
          <Card style={{ backgroundColor: c.sage, borderWidth: 0 }}>
            <Txt style={{ fontFamily: f.bold, fontSize: 12, marginBottom: 5 }}>
              MAKE IT FEEL RIGHT
            </Txt>
            <Txt style={{ fontSize: 13 }}>{exercise.tip}</Txt>
          </Card>
        </>
      )}
    </Sheet>
  );
}
export function FinishSheet({
  record,
  onClose,
}: {
  record: WorkoutRecord | null;
  onClose: () => void;
}) {
  const store = useStore();
  return (
    <Sheet visible={!!record} onClose={onClose} title="One more promise kept.">
      {record && (
        <>
          <View style={{ alignItems: "center", gap: 14, paddingVertical: 16 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: c.sage,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircle2 size={42} color={c.green} strokeWidth={1.3} />
            </View>
            <Title style={{ textAlign: "center" }}>
              That’s you, getting stronger.
            </Title>
            <Txt muted style={{ textAlign: "center" }}>
              {record.name} is in the books.
            </Txt>
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-around" }}
          >
            {[
              {
                value: record.sets.filter((s) => s.done).length,
                label: "sets completed",
              },
              {
                value: Math.max(1, Math.round(record.durationSeconds / 60)),
                label: "minutes of you",
              },
            ].map((x) => (
              <View key={x.label} style={{ alignItems: "center", gap: 6 }}>
                <Title>{x.value}</Title>
                <Txt muted style={{ fontSize: 12 }}>
                  {x.label}
                </Txt>
              </View>
            ))}
          </View>
          <Button
            onPress={() => {
              onClose();
              if (store.auth)
                store.sync().catch((e) => store.setError(e.message));
            }}
          >
            See my progress
          </Button>
        </>
      )}
    </Sheet>
  );
}
export function NoticeSheet({
  visible,
  onClose,
  onPlan,
}: {
  visible: boolean;
  onClose: () => void;
  onPlan: () => void;
}) {
  const { state } = useStore();
  return (
    <Sheet visible={visible} onClose={onClose} title="A little encouragement">
      <View style={u.row}>
        <Leaf size={24} color={c.green} />
        <Txt style={{ fontFamily: f.bold }}>Your next session is ready.</Txt>
      </View>
      <Txt muted>
        Your plan fits {state.profile.days.length} days a week. Come back when
        it works for you—your progress is saved on this device.
      </Txt>
      <Button kind="dark" onPress={onPlan}>
        View my week
      </Button>
    </Sheet>
  );
}
export function ErrorSheet({
  error,
  onClose,
}: {
  error: string;
  onClose: () => void;
}) {
  return (
    <Sheet visible={!!error} onClose={onClose} title="Let’s sort that out">
      <Txt accessibilityRole="alert">{error}</Txt>
      <Button kind="dark" onPress={onClose}>
        Got it
      </Button>
    </Sheet>
  );
}

export function AccountSheet({
  visible,
  onClose,
  onSuccess,
  defaultMode = "create",
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultMode?: "create" | "login";
}) {
  const { authenticate } = useStore();
  const [mode, setMode] = useState(defaultMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      visible={visible}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={mode === "create" ? "Give your progress a home." : "Welcome back."}
    >
      <Txt muted>
        {mode === "create"
          ? "Keep your training connected with a private FORMA account."
          : "Sign in to restore your synced training profile."}
      </Txt>
      {mode === "create" && (
        <View>
          <Txt style={u.label}>Your name</Txt>
          <TextInput
            accessibilityLabel="Account name"
            value={name}
            onChangeText={setName}
            placeholder="What should we call you?"
            maxLength={40}
            style={u.input}
            autoComplete="name"
          />
        </View>
      )}
      <View>
        <Txt style={u.label}>Email</Txt>
        <TextInput
          accessibilityLabel="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={u.input}
        />
      </View>
      <View>
        <Txt style={u.label}>Password</Txt>
        <TextInput
          accessibilityLabel="Password"
          value={password}
          onChangeText={setPassword}
          placeholder={
            mode === "create" ? "At least 8 characters" : "Your password"
          }
          secureTextEntry
          autoComplete={mode === "create" ? "new-password" : "current-password"}
          style={u.input}
        />
      </View>
      {!!error && (
        <Txt
          accessibilityRole="alert"
          style={{ color: c.danger, fontSize: 12 }}
        >
          {error}
        </Txt>
      )}
      <Button
        disabled={busy}
        kind="dark"
        onPress={async () => {
          setError("");
          if (
            !email.includes("@") ||
            password.length < 8 ||
            (mode === "create" && !name.trim())
          ) {
            setError(
              "Add a valid email, a password of at least 8 characters, and your name if creating an account.",
            );
            return;
          }
          setBusy(true);
          try {
            await authenticate(
              email.trim(),
              password,
              mode === "create" ? name.trim() : undefined,
            );
            setPassword("");
            onSuccess();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Connecting…"
          : mode === "create"
            ? "Create my account"
            : "Sign in"}
      </Button>
      <Button
        kind="ghost"
        onPress={() => {
          setMode(mode === "create" ? "login" : "create");
          setError("");
        }}
      >
        {mode === "create"
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </Button>
      <Txt muted style={{ fontSize: 11, textAlign: "center" }}>
        Training without an account? Your workouts stay saved on this device.
      </Txt>
    </Sheet>
  );
}

export { PlusSheet } from "./MembershipPaywall";
