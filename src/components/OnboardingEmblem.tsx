import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import { colors as c } from "../theme";

type OnboardingEmblemProps = {
  reducedMotion: boolean;
  /** Completed setup answers, from zero to five. This is not a fitness score. */
  progress?: number;
  compact?: boolean;
  /** Use the lighter ring palette over FORMA's dark surfaces. */
  light?: boolean;
};

const nativeDriver = Platform.OS !== "web";
const orbitPoints = Array.from({ length: 5 }, (_, index) => {
  const angle = ((index * 72 - 90) * Math.PI) / 180;
  return { x: 100 + Math.cos(angle) * 83, y: 100 + Math.sin(angle) * 83 };
});

/**
 * A finite brand entrance with a quiet reflection of setup progress.
 * All animation is confined to opacity and transforms on native views.
 */
export default function OnboardingEmblem({
  reducedMotion,
  progress = 0,
  compact = false,
  light = false,
}: OnboardingEmblemProps) {
  const size = compact ? 64 : 180;
  const scale = size / 200;
  const complete = Math.max(0, Math.min(5, Math.floor(progress)));
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const bars = useRef(
    Array.from({ length: 3 }, () => new Animated.Value(reducedMotion ? 1 : 0)),
  ).current;
  const dots = useRef(
    Array.from(
      { length: 5 },
      (_, index) => new Animated.Value(index < complete ? 1 : 0),
    ),
  ).current;

  useEffect(() => {
    entrance.stopAnimation();
    bars.forEach((bar) => bar.stopAnimation());

    if (reducedMotion) {
      entrance.setValue(1);
      bars.forEach((bar) => bar.setValue(1));
      return;
    }

    entrance.setValue(0);
    bars.forEach((bar) => bar.setValue(0));
    const animation = Animated.parallel([
      Animated.timing(entrance, {
        toValue: 1,
        duration: 760,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: nativeDriver,
        isInteraction: false,
      }),
      Animated.stagger(
        85,
        bars.map((bar) =>
          Animated.spring(bar, {
            toValue: 1,
            stiffness: 175,
            damping: 22,
            mass: 0.8,
            overshootClamping: true,
            restDisplacementThreshold: 0.01,
            restSpeedThreshold: 0.01,
            useNativeDriver: nativeDriver,
            isInteraction: false,
          }),
        ),
      ),
    ]);
    animation.start();
    // Bound the decorative entrance even on a heavily throttled JS runtime.
    const settle = setTimeout(() => {
      animation.stop();
      entrance.setValue(1);
      bars.forEach((bar) => bar.setValue(1));
    }, 1300);

    return () => {
      clearTimeout(settle);
      animation.stop();
    };
  }, [bars, entrance, reducedMotion]);

  useEffect(() => {
    dots.forEach((dot) => dot.stopAnimation());
    if (reducedMotion) {
      dots.forEach((dot, index) => dot.setValue(index < complete ? 1 : 0));
      return;
    }
    const animation = Animated.parallel(
      dots.map((dot, index) =>
        Animated.timing(dot, {
          toValue: index < complete ? 1 : 0,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: nativeDriver,
          isInteraction: false,
        }),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [complete, dots, reducedMotion]);

  const ring = light ? c.cream : c.green;
  const dotBackground = light ? c.dark : c.bg;

  return (
    <View
      aria-hidden={true}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: size, height: size }}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: entrance,
            transform: [
              {
                rotate: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["-16deg", "0deg"],
                }),
              },
              {
                scale: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.88, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Svg
          width={size}
          height={size}
          viewBox="0 0 200 200"
          aria-hidden={true}
        >
          <Circle
            cx="100"
            cy="100"
            r="94"
            fill="none"
            stroke={ring}
            strokeOpacity={0.08}
          />
          <Circle
            cx="100"
            cy="100"
            r="83"
            fill="none"
            stroke={ring}
            strokeOpacity={0.21}
          />
          <Circle
            cx="100"
            cy="100"
            r="66"
            fill="none"
            stroke={ring}
            strokeOpacity={0.12}
          />
          <Circle
            cx="100"
            cy="100"
            r="48"
            fill="none"
            stroke={ring}
            strokeOpacity={0.05}
          />
          <Path
            d="M 170.43 144.43 A 83 83 0 0 1 131.17 176.94"
            fill="none"
            stroke={c.orange}
            strokeOpacity={0.6}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <G stroke={ring} strokeOpacity={0.3} strokeWidth={0.8}>
            <Line x1="22" y1="157" x2="30" y2="157" />
            <Line x1="26" y1="153" x2="26" y2="161" />
          </G>
          <Circle cx="177" cy="42" r="2" fill={c.orange} />
          <Circle cx="183" cy="47" r="1.1" fill={ring} fillOpacity={0.4} />
          <Circle cx="180" cy="34" r="1" fill={ring} fillOpacity={0.3} />
          {orbitPoints.map((point, index) => (
            <Circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={compact ? 3 : 3.4}
              fill={dotBackground}
              stroke={ring}
              strokeOpacity={0.32}
              strokeWidth={1}
            />
          ))}
        </Svg>
        {orbitPoints.map((point, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                left: (point.x - 3.4) * scale,
                top: (point.y - 3.4) * scale,
                width: 6.8 * scale,
                height: 6.8 * scale,
                borderRadius: 3.4 * scale,
                opacity: dots[index],
                backgroundColor: c.orange,
              },
            ]}
          />
        ))}
      </Animated.View>

      {[
        { x: 68, y: 76, height: 48 },
        { x: 91, y: 62, height: 76 },
        { x: 114, y: 70, height: 60 },
      ].map((bar, index) => (
        <Animated.View
          key={index}
          style={{
            position: "absolute",
            left: (bar.x - 12) * scale,
            top: bar.y * scale,
            width: 40 * scale,
            height: bar.height * scale,
            opacity: bars[index],
            transform: [
              {
                translateY: bars[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [18 * scale, 0],
                }),
              },
              {
                scaleY: bars[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 1],
                }),
              },
            ],
          }}
        >
          <Svg
            width="100%"
            height="100%"
            viewBox={"0 0 40 " + bar.height}
            aria-hidden={true}
          >
            <G transform={"translate(20 " + bar.height / 2 + ") skewX(-17)"}>
              <Rect
                x="-8.25"
                y={-bar.height / 2}
                width="16.5"
                height={bar.height}
                rx="1.5"
                fill={c.orange}
              />
            </G>
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: "absolute" },
});
