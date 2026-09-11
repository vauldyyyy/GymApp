import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
  Modal,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { ArrowUpRight, X } from "lucide-react-native";
import { colors as c, fonts as f } from "../theme";
export function Txt({
  children,
  style,
  muted = false,
  ...props
}: React.ComponentProps<typeof Text> & { muted?: boolean }) {
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: f.regular,
          fontSize: 14,
          color: muted ? c.muted : c.ink,
          lineHeight: 21,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Button({
  children,
  onPress,
  kind = "primary",
  style,
  disabled = false,
  icon,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  kind?: "primary" | "dark" | "light" | "ghost";
  style?: ViewStyle;
  disabled?: boolean;
  icon?: React.ReactNode;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        {
          minHeight: 50,
          borderRadius: 100,
          paddingHorizontal: 22,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          backgroundColor:
            kind === "primary"
              ? c.orangeDark
              : kind === "dark"
                ? c.ink
                : kind === "light"
                  ? c.sage
                  : "transparent",
          opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
          ...(Platform.OS === "web"
            ? {
                cursor: disabled ? "auto" : "pointer",
                transition: "background-color 180ms, opacity 180ms",
              }
            : {}),
          ...(hovered && !disabled ? { opacity: 0.86 } : {}),
        },
        style,
      ]}
    >
      <Txt
        style={{
          fontFamily: f.bold,
          color: kind === "primary" || kind === "dark" ? "white" : c.ink,
        }}
      >
        {children}
      </Txt>
      {icon}
    </Pressable>
  );
}
export function IconButton({
  icon,
  onPress,
  label,
  style,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  label: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 48,
          height: 48,
          borderRadius: 24,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: c.paper,
          borderWidth: 1,
          borderColor: c.line,
          opacity: pressed ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}
export function Eyebrow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return (
    <Txt
      style={[
        {
          fontFamily: f.bold,
          fontSize: 10,
          letterSpacing: 2,
          lineHeight: 16,
          textTransform: "uppercase",
        },
        style,
      ]}
    >
      {children}
    </Txt>
  );
}
export function Title({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return (
    <Txt
      accessibilityRole="header"
      style={[
        {
          fontFamily: f.heavy,
          fontSize: 32,
          letterSpacing: -1.2,
          lineHeight: 40,
        },
        style,
      ]}
    >
      {children}
    </Txt>
  );
}
export function SectionTitle({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
        gap: 12,
      }}
    >
      <Txt
        accessibilityRole="header"
        style={{
          fontFamily: f.display,
          fontSize: 20,
          lineHeight: 27,
          letterSpacing: -0.5,
          flexShrink: 1,
        }}
      >
        {title}
      </Txt>
      {action && onPress && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Txt style={{ fontSize: 12, fontFamily: f.bold }}>{action}</Txt>
          <ArrowUpRight size={15} color={c.ink} />
        </Pressable>
      )}
    </View>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: c.paper,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: 20,
          padding: 22,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function FadeIn({
  children,
  style,
  delay = 0,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  delay?: number;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (alive)
        Animated.timing(v, {
          toValue: 1,
          duration: reduce ? 0 : 380,
          delay: reduce ? 0 : delay,
          useNativeDriver: Platform.OS !== "web",
        }).start();
    });
    return () => {
      alive = false;
      v.stopAnimation();
    };
  }, []);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
export function Sheet({
  visible,
  onClose,
  title,
  children,
  wide = false,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { width } = useWindowDimensions();
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => listener.remove();
  }, []);
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduce ? "none" : "fade"}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#171B1888",
          justifyContent: "center",
          alignItems: "center",
          padding: width < 600 ? 12 : 32,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: c.bg,
            borderRadius: 26,
            width: "100%",
            maxWidth: wide ? 900 : 540,
            maxHeight: "94%",
            overflow: "hidden",
            borderWidth: 1,
            borderColor: c.line,
          }}
        >
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 18,
              paddingBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Txt
              accessibilityRole="header"
              style={{ fontFamily: f.display, fontSize: 20, flexShrink: 1 }}
            >
              {title}
            </Txt>
            <IconButton
              label="Close dialog"
              onPress={onClose}
              icon={<X size={19} color={c.ink} />}
            />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, paddingTop: 10, gap: 20 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  input: {
    fontFamily: f.regular,
    fontSize: 15,
    color: c.ink,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.paper,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  divider: { height: 1, backgroundColor: c.line },
  pill: {
    borderRadius: 40,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: c.sage,
  },
  label: { fontFamily: f.bold, fontSize: 12, marginBottom: 7 },
});
