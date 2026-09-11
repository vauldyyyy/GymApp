import React from "react";
import { Pressable, View } from "react-native";
import {
  ArrowUpRight,
  Bookmark,
  Dumbbell,
  MoveUpRight,
  StretchHorizontal,
  Timer,
  Wind,
} from "lucide-react-native";
import { Workout } from "../types";
import { colors as c, fonts as f } from "../theme";
import { Eyebrow, Txt } from "./UI";
export default function WorkoutCard({
  workout,
  onPress,
  saved,
  onSave,
  compact = false,
}: {
  workout: Workout;
  onPress: () => void;
  saved?: boolean;
  onSave?: () => void;
  compact?: boolean;
}) {
  const Icon =
    workout.category === "Mobility"
      ? Wind
      : workout.category === "Core"
        ? StretchHorizontal
        : Dumbbell;
  return (
    <View
      style={{
        flex: 1,
        minWidth: 200,
        backgroundColor: c.paper,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${workout.name}`}
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
      >
        <View
          style={{
            height: compact ? 126 : 174,
            backgroundColor: workout.accent,
            padding: 20,
            overflow: "hidden",
            justifyContent: "space-between",
          }}
        >
          <Eyebrow style={{ fontSize: 9, color: c.green }}>
            {workout.category} / FORMA STUDIO
          </Eyebrow>
          <View
            style={{
              position: "absolute",
              width: 220,
              height: 220,
              borderRadius: 110,
              borderWidth: 1,
              borderColor: "#FFFFFF80",
              right: 2,
              top: -20,
            }}
          />
          <View
            style={{
              position: "absolute",
              width: 168,
              height: 168,
              borderRadius: 84,
              borderWidth: 1,
              borderColor: "#FFFFFFA0",
              right: 28,
              top: 6,
            }}
          />
          <View
            style={{
              position: "absolute",
              right: 54,
              top: compact ? 22 : 42,
              transform: [{ rotate: "-22deg" }],
            }}
          >
            <Icon size={compact ? 82 : 100} color={c.green} strokeWidth={0.9} />
          </View>
          <Txt
            style={{
              fontFamily: f.heavy,
              fontSize: compact ? 30 : 44,
              lineHeight: 50,
              color: c.green,
              letterSpacing: -2,
            }}
          >
            {workout.minutes}
            <Txt style={{ fontSize: 13, color: c.green }}> min</Txt>
          </Txt>
        </View>
        <View style={{ padding: 19, gap: 6 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <Txt style={{ fontFamily: f.bold, fontSize: 15, flex: 1 }}>
              {workout.name}
            </Txt>
            <ArrowUpRight size={18} color={c.ink} />
          </View>
          <Txt muted style={{ fontSize: 12 }}>
            {workout.exercises.length} exercises ·{" "}
            {workout.category === "Mobility"
              ? "An easy reset"
              : "Move at your pace"}
          </Txt>
        </View>
      </Pressable>
      {onSave && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            saved ? `Unsave ${workout.name}` : `Save ${workout.name}`
          }
          accessibilityState={{ selected: saved }}
          onPress={onSave}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 44,
            height: 44,
            backgroundColor: "#FFFFFFB0",
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Bookmark
            size={18}
            color={c.green}
            fill={saved ? c.green : "transparent"}
          />
        </Pressable>
      )}
    </View>
  );
}
