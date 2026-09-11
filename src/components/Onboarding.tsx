import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  findNodeHandle,
  Keyboard,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  ChevronUp,
  Clock3,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Layers3,
  Leaf,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react-native";
import { colors, fonts } from "../theme";
import type { Equipment, Experience, Goal, Profile } from "../types";
import { buildPlan } from "../data";
import * as Haptics from "expo-haptics";
import { Sheet } from "./UI";
import OnboardingPlanPreview from "./OnboardingPlanPreview";
import OnboardingEmblem from "./OnboardingEmblem";

type Props = {
  initial: Profile;
  onComplete: (profile: Profile) => void;
  onExit?: () => void;
  onSignIn?: () => void;
};
type Choice<T extends string> = { value: T; detail: string; icon: LucideIcon };

const goals: Choice<Goal>[] = [
  {
    value: "Build strength",
    detail: "Feel more capable, one lift at a time.",
    icon: TrendingUp,
  },
  {
    value: "Build muscle",
    detail: "Make consistent training your foundation.",
    icon: Dumbbell,
  },
  {
    value: "Feel fitter",
    detail: "More movement. More energy for everyday life.",
    icon: Heart,
  },
];
const experiences: Choice<Experience>[] = [
  {
    value: "Getting started",
    detail: "I’m new, or finding my rhythm again.",
    icon: Leaf,
  },
  {
    value: "Some experience",
    detail: "I know the basics and train occasionally.",
    icon: Layers3,
  },
  {
    value: "Very experienced",
    detail: "Training is already part of my routine.",
    icon: Flame,
  },
];
const equipmentOptions: Choice<Equipment>[] = [
  {
    value: "Full gym",
    detail: "Barbells, machines and room to grow.",
    icon: Dumbbell,
  },
  {
    value: "Dumbbells",
    detail: "A pair of weights. Plenty of possibilities.",
    icon: Target,
  },
  {
    value: "Bodyweight",
    detail: "Just me and a little space to move.",
    icon: Footprints,
  },
];
const week = [
  { id: 1, short: "Mon", full: "Monday" },
  { id: 2, short: "Tue", full: "Tuesday" },
  { id: 3, short: "Wed", full: "Wednesday" },
  { id: 4, short: "Thu", full: "Thursday" },
  { id: 5, short: "Fri", full: "Friday" },
  { id: 6, short: "Sat", full: "Saturday" },
  { id: 0, short: "Sun", full: "Sunday" },
];
const stepLabels = [
  "Welcome",
  "Your direction",
  "Your starting point",
  "Your space",
  "Your rhythm",
  "The finishing touches",
  "Made for you",
];
const heroImage = require("../../assets/images/training-hero.png");

function ChoiceCard<T extends string>({
  choice,
  selected,
  onPress,
  reducedMotion,
}: {
  choice: Choice<T>;
  selected: boolean;
  onPress: () => void;
  reducedMotion: boolean;
}) {
  const Icon = choice.icon;
  const selection = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    selection.stopAnimation();
    if (reducedMotion) {
      selection.setValue(selected ? 1 : 0);
      return;
    }
    const animation = Animated.spring(selection, {
      toValue: selected ? 1 : 0,
      damping: 16,
      stiffness: 230,
      mass: 0.7,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [selected, reducedMotion, selection]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${choice.value}. ${choice.detail}`}
      accessibilityState={{ selected }}
      aria-pressed={selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <Animated.View
        style={[
          styles.choiceIcon,
          selected && styles.choiceIconSelected,
          {
            transform: [
              {
                scale: selection.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.08],
                }),
              },
            ],
          },
        ]}
        aria-hidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        <Icon
          size={23}
          strokeWidth={1.7}
          color={selected ? colors.orangeDark : colors.ink}
        />
      </Animated.View>
      <View style={styles.choiceText}>
        <Text style={styles.choiceTitle}>{choice.value}</Text>
        <Text style={styles.choiceDetail}>{choice.detail}</Text>
      </View>
      <View
        style={[styles.radio, selected && styles.radioSelected]}
        aria-hidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View
          style={{ opacity: selection, transform: [{ scale: selection }] }}
        >
          <Check size={13} strokeWidth={3} color={colors.paper} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

function SetupProgress({
  step,
  reducedMotion,
}: {
  step: number;
  reducedMotion: boolean;
}) {
  const filled = useRef(new Animated.Value(Math.min(step, 5))).current;
  useEffect(() => {
    filled.stopAnimation();
    if (reducedMotion) {
      filled.setValue(Math.min(step, 5));
      return;
    }
    const animation = Animated.timing(filled, {
      toValue: Math.min(step, 5),
      duration: 440,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [step, reducedMotion, filled]);
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel="Plan setup progress"
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={Math.min(step, 5)}
      aria-valuetext={step === 6 ? "Plan ready" : "Question " + step + " of 5"}
      accessibilityValue={{
        min: 0,
        max: 5,
        now: Math.min(step, 5),
        text: step === 6 ? "Plan ready" : "Question " + step + " of 5",
      }}
    >
      {[0, 1, 2, 3, 4].map((index) => (
        <View key={index} style={styles.progressPart}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.progressPartActive,
              {
                opacity: filled.interpolate({
                  inputRange: [index, index + 1],
                  outputRange: [0, 1],
                  extrapolate: "clamp",
                }),
                transform: [
                  {
                    scaleX: filled.interpolate({
                      inputRange: [index, index + 1],
                      outputRange: [0.05, 1],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <View style={styles.brandRow} accessibilityLabel="Forma">
      <View style={styles.brandMark} aria-hidden={true}>
        {[15, 24, 19].map((height, i) => (
          <View
            key={i}
            style={[
              styles.brandBar,
              { height, backgroundColor: colors.orange },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.brand, light && styles.lightText]}>FORMA</Text>
    </View>
  );
}

export default function Onboarding({
  initial,
  onComplete,
  onExit,
  onSignIn,
}: Props) {
  const { width, height, fontScale } = useWindowDimensions();
  const wide = width >= 960;
  const short = height < 600 || fontScale > 1.4;
  const [profile, setProfile] = useState<Profile>(() => ({
    ...initial,
    days: initial.onboardingDone ? [...initial.days] : [],
  }));
  const [answered, setAnswered] = useState<number[]>(
    initial.onboardingDone ? [1, 2, 3, 4, 5] : [],
  );
  const [step, setStep] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const entrance = useRef(new Animated.Value(1)).current;
  const feedback = useRef(new Animated.Value(1)).current;
  const scroll = useRef<ScrollView>(null);
  const questionHeading = useRef<View>(null);
  const direction = useRef(1);
  const lastNavigation = useRef(0);
  const completed = useRef(false);
  const plan = useMemo(() => buildPlan(profile), [profile]);
  const selectedDays = week.filter((day) => profile.days.includes(day.id));
  const validDays = selectedDays.length >= 2 && selectedDays.length <= 5;
  const blocked =
    step > 0 &&
    step < 6 &&
    (!answered.includes(step) || (step === 4 && !validDays));
  const previewSummary =
    answered.includes(4) && answered.includes(5)
      ? selectedDays.length +
        (selectedDays.length === 1 ? " day" : " days") +
        " / week · " +
        profile.duration +
        " min budget"
      : answered.includes(4)
        ? selectedDays.length + " training days · choose your session time"
        : answered.includes(3)
          ? profile.equipment + " · choose your training days"
          : answered.includes(1)
            ? profile.goal + " · your choices shape what comes next"
            : "Choose your goal to start shaping your plan";
  const trainingKey = [
    profile.goal,
    profile.experience,
    profile.equipment,
    profile.days.join(","),
    profile.duration,
  ].join("|");

  useEffect(() => {
    if (step === 0) return;
    let active = true;
    if (Platform.OS === "web") questionHeading.current?.focus();
    else
      AccessibilityInfo.isScreenReaderEnabled()
        .then((enabled) => {
          if (!active || !enabled) return;
          const node = findNodeHandle(questionHeading.current);
          if (node) AccessibilityInfo.setAccessibilityFocus(node);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [step]);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReducedMotion(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useLayoutEffect(() => {
    entrance.stopAnimation();
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (reducedMotion) {
      entrance.setValue(1);
      return;
    }
    entrance.setValue(0);
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: step === 6 ? 600 : 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [step, reducedMotion, entrance]);

  useEffect(() => {
    feedback.stopAnimation();
    if (reducedMotion) {
      feedback.setValue(1);
      return;
    }
    feedback.setValue(0);
    const animation = Animated.timing(feedback, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [trainingKey, reducedMotion, feedback]);

  const go = (nextStep: number) => {
    if (Date.now() - lastNavigation.current < 350) return;
    lastNavigation.current = Date.now();
    direction.current = nextStep > step ? 1 : -1;
    completed.current = false;
    Keyboard.dismiss();
    setStep(nextStep);
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (previewOpen) {
          setPreviewOpen(false);
          return true;
        }
        if (step > 0) {
          go(step - 1);
          return true;
        }
        if (onExit) {
          onExit();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [step, previewOpen, onExit]);

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    // Ignore a second tap landing on a newly entered screen during navigation.
    if (key !== "name" && Date.now() - lastNavigation.current < 350) return;
    setProfile((previous) => ({ ...previous, [key]: value }));
    const question = (
      { goal: 1, experience: 2, equipment: 3, days: 4, duration: 5 } as Partial<
        Record<keyof Profile, number>
      >
    )[key];
    if (question)
      setAnswered((previous) =>
        previous.includes(question) ? previous : [...previous, question],
      );
    if (key !== "name" && Platform.OS !== "web")
      Haptics.selectionAsync().catch(() => {});
  };
  const toggleDay = (id: number) => {
    if (profile.days.includes(id))
      update(
        "days",
        profile.days.filter((day) => day !== id),
      );
    else if (selectedDays.length < 5) update("days", [...profile.days, id]);
  };
  const next = () => {
    if (blocked) return;
    if (step === 6) {
      if (Date.now() - lastNavigation.current < 350) return;
      if (completed.current) return;
      completed.current = true;
      if (Platform.OS !== "web")
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      onComplete({
        ...profile,
        name: profile.name.trim().slice(0, 40),
        days: selectedDays.map((day) => day.id),
        onboardingDone: true,
      });
    } else go(step + 1);
  };

  const titles = [
    "",
    "What are you\nworking toward?",
    "Every starting point\nis a good one.",
    "Your space.\nYour possibilities.",
    "Find your\nweekly rhythm.",
    "Make it fit\nyour day.",
    profile.name.trim()
      ? "Your first chapter,\n" + profile.name.trim() + "."
      : "Your first week.\nA fresh beginning.",
  ];
  const subtitles = [
    "",
    "Choose what matters most. Watch your plan take shape as you go.",
    "We’ll use this to set the number of working sets in your sessions.",
    "Good training starts with what you have available.",
    "Choose 2–5 training days. Make room for recovery and real life.",
    "How much time would you like to make for a session?",
    "A real starting plan, built around your choices. You can adjust it anytime.",
  ];
  const response = !answered.includes(step)
    ? step === 4
      ? "Choose at least 2 training days to continue."
      : "Make a choice above. Nothing is selected for you."
    : step === 1
      ? profile.goal === "Build strength"
        ? "A repeatable routine, with strength at its heart."
        : profile.goal === "Build muscle"
          ? "Consistent resistance training, one session at a time."
          : "A mix of strength and movement for your week."
      : step === 2
        ? profile.experience === "Getting started"
          ? "A manageable start: up to 2 working sets per exercise."
          : "Your sessions use the full working sets for each exercise."
        : step === 3
          ? profile.equipment === "Bodyweight"
            ? "Your preview now uses equipment-free movements."
            : profile.equipment === "Dumbbells"
              ? "Your preview uses dumbbell and bodyweight movements."
              : "Your preview can use machines, dumbbells and bodyweight."
          : step === 4
            ? validDays
              ? selectedDays.length +
                " training days. " +
                (7 - selectedDays.length) +
                " days with room to recover."
              : "Choose at least 2 training days to continue."
            : "Your first session has " +
              (plan[0]?.workout.exercises.length || 0) +
              " exercises. Shorter recovery sessions may also appear.";

  const primaryAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked }}
      disabled={blocked}
      onPress={next}
      style={({ pressed }) => [
        styles.primary,
        blocked && styles.primaryDisabled,
        pressed && !blocked && styles.primaryPressed,
      ]}
    >
      <Text style={styles.primaryText}>
        {step === 0
          ? "Build my plan"
          : step === 6
            ? initial.onboardingDone
              ? "Save my plan"
              : "Choose my membership"
            : step === 5
              ? "Reveal my plan"
              : "Continue"}
      </Text>
      <ArrowRight size={21} color={colors.paper} aria-hidden={true} />
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {wide && (step === 0 || step === 6) && (
        <ImageBackground
          source={require("../../assets/images/training-onboarding.png")}
          resizeMode="cover"
          style={styles.campaign}
          imageStyle={styles.campaignImage}
          aria-hidden={true}
        >
          <LinearGradient
            colors={[
              "rgba(16,22,17,0.24)",
              "rgba(16,22,17,0.03)",
              "rgba(16,22,17,0.88)",
            ]}
            locations={[0, 0.42, 1]}
            style={styles.campaignGradient}
          >
            <Brand light />
            <View style={styles.campaignBottom}>
              <View style={styles.campaignTag}>
                <View style={styles.orangeDot} />
                <Text style={styles.campaignTagText}>
                  A LITTLE STRONGER. EVERY DAY.
                </Text>
              </View>
              <Text style={styles.campaignTitle}>
                {step === 6
                  ? "A little stronger.\nStarting today."
                  : "Built around\nyour life."}
              </Text>
              <Text style={styles.campaignBody}>
                {step === 6
                  ? "You’ve made room for yourself.\nNow let’s make something of it."
                  : "Good training meets you where you are.\nYour next chapter starts here."}
              </Text>
              <View style={styles.campaignFooter}>
                <Text style={styles.campaignFootnote}>
                  YOUR PACE. YOUR PROGRESS.
                </Text>
                <ArrowRight size={22} color={colors.cream} />
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      )}
      {wide && step > 0 && step < 6 && (
        <ScrollView
          style={styles.studioPane}
          contentContainerStyle={styles.studioContent}
          showsVerticalScrollIndicator={false}
        >
          <Brand light />
          <View style={styles.studioHero}>
            <View style={styles.studioHeading}>
              <Text style={styles.studioEyebrow}>BUILT AROUND YOU</Text>
              <Text
                style={[
                  styles.studioTitle,
                  width < 1200 && styles.studioTitleNarrow,
                ]}
              >
                A plan that{"\n"}moves with you.
              </Text>
            </View>
            <OnboardingEmblem
              light
              reducedMotion={reducedMotion}
              progress={Math.min(step, 5)}
              compact={width < 1250 || height < 850}
            />
          </View>
          <OnboardingPlanPreview
            profile={profile}
            reducedMotion={reducedMotion}
            expanded
            step={step}
            confirmed={answered}
          />
          <Text style={styles.studioFootnote}>
            Your choices shape this preview. You’re always in control.
          </Text>
        </ScrollView>
      )}

      <View style={[styles.formPane, wide && styles.formPaneWide]}>
        <View style={[styles.topbar, wide && styles.topbarWide]}>
          {step === 0 ? (
            <Brand />
          ) : (
            <Pressable
              onPress={() => go(step - 1)}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <ArrowLeft size={20} color={colors.ink} aria-hidden={true} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          )}
          <Text style={styles.topbarNote}>
            {step === 0
              ? "YOUR STRONGER EVERYDAY"
              : step === 6
                ? "YOUR PLAN, READY"
                : "QUESTION " + String(step).padStart(2, "0") + " / 05"}
          </Text>
        </View>
        {step > 0 && (
          <View
            style={[styles.progressInset, wide && styles.progressInsetWide]}
          >
            <SetupProgress step={step} reducedMotion={reducedMotion} />
          </View>
        )}
        <ScrollView
          ref={scroll}
          style={styles.scroller}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            wide && styles.scrollContentWide,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: entrance,
                transform: [
                  {
                    translateX: entrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [24 * direction.current, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {step === 0 ? (
              <>
                {!wide && (
                  <ImageBackground
                    source={heroImage}
                    resizeMode="cover"
                    style={styles.mobileHero}
                    imageStyle={styles.mobileHeroImage}
                    aria-hidden={true}
                  >
                    <LinearGradient
                      colors={["transparent", "rgba(16,22,17,0.58)"]}
                      style={styles.mobileHeroGradient}
                    >
                      <View style={styles.photoEmblem}>
                        <OnboardingEmblem
                          reducedMotion={reducedMotion}
                          light
                          compact
                          progress={0}
                        />
                      </View>
                      <View style={styles.photoTag}>
                        <View style={styles.orangeDot} />
                        <Text style={styles.photoTagText}>
                          MAKE ROOM FOR YOU.
                        </Text>
                      </View>
                    </LinearGradient>
                  </ImageBackground>
                )}
                {wide && (
                  <View style={styles.welcomeEmblem}>
                    <OnboardingEmblem
                      reducedMotion={reducedMotion}
                      compact
                      progress={0}
                    />
                  </View>
                )}
                <Text style={styles.eyebrow}>
                  MEET YOUR EVERYDAY TRAINING PARTNER
                </Text>
                <Text
                  accessibilityRole="header"
                  style={[styles.welcomeTitle, wide && styles.welcomeTitleWide]}
                >
                  Your next chapter starts{" "}
                  <Text style={styles.orangeText}>strong.</Text>
                </Text>
                <Text style={styles.introBody}>
                  A thoughtful plan. Space to find your rhythm. And a little
                  progress you can feel, every day.
                </Text>
                <View style={styles.welcomeMeta}>
                  <View style={styles.metaItem}>
                    <Clock3 size={16} color={colors.green} aria-hidden={true} />
                    <Text style={styles.metaText}>5 simple questions</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <CheckCircle2
                      size={16}
                      color={colors.green}
                      aria-hidden={true}
                    />
                    <Text style={styles.metaText}>No account needed</Text>
                  </View>
                </View>
                <View style={styles.introActions}>
                  {primaryAction}
                  <Text style={styles.actionHint}>
                    Your plan starts taking shape with your first answer.
                  </Text>
                  {onExit && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={onExit}
                      style={({ pressed }) => [
                        styles.explore,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.exploreText}>Explore first</Text>
                      <ArrowRight
                        size={16}
                        color={colors.ink}
                        aria-hidden={true}
                      />
                    </Pressable>
                  )}
                  {onSignIn && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={onSignIn}
                      style={({ pressed }) => [
                        styles.explore,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.exploreText}>
                        Already a member? Sign in
                      </Text>
                    </Pressable>
                  )}
                </View>
              </>
            ) : (
              <>
                {step === 6 && (
                  <View style={styles.revealEmblem}>
                    <OnboardingEmblem
                      reducedMotion={reducedMotion}
                      progress={5}
                      compact
                    />
                  </View>
                )}
                <Text style={styles.eyebrow} accessibilityLiveRegion="polite">
                  {stepLabels[step].toUpperCase()}
                </Text>
                <View
                  ref={questionHeading}
                  accessible
                  accessibilityRole="header"
                  accessibilityLabel={titles[step].replace("\n", " ")}
                  tabIndex={-1}
                >
                  <Text
                    style={[styles.title, wide && styles.questionTitleWide]}
                  >
                    {titles[step]}
                  </Text>
                </View>
                <Text style={styles.subtitle}>{subtitles[step]}</Text>

                {step === 1 && (
                  <View style={styles.choiceList}>
                    {goals.map((choice) => (
                      <ChoiceCard
                        key={choice.value}
                        choice={choice}
                        selected={
                          answered.includes(1) && profile.goal === choice.value
                        }
                        reducedMotion={reducedMotion}
                        onPress={() => update("goal", choice.value)}
                      />
                    ))}
                  </View>
                )}
                {step === 2 && (
                  <View style={styles.choiceList}>
                    {experiences.map((choice) => (
                      <ChoiceCard
                        key={choice.value}
                        choice={choice}
                        selected={
                          answered.includes(2) &&
                          profile.experience === choice.value
                        }
                        reducedMotion={reducedMotion}
                        onPress={() => update("experience", choice.value)}
                      />
                    ))}
                  </View>
                )}
                {step === 3 && (
                  <View style={styles.choiceList}>
                    {equipmentOptions.map((choice) => (
                      <ChoiceCard
                        key={choice.value}
                        choice={choice}
                        selected={
                          answered.includes(3) &&
                          profile.equipment === choice.value
                        }
                        reducedMotion={reducedMotion}
                        onPress={() => update("equipment", choice.value)}
                      />
                    ))}
                  </View>
                )}
                {step === 4 && (
                  <View style={styles.daysGrid}>
                    {week.map((day) => {
                      const selected = profile.days.includes(day.id);
                      const disabled = !selected && selectedDays.length >= 5;
                      return (
                        <Pressable
                          key={day.id}
                          onPress={() => toggleDay(day.id)}
                          disabled={disabled}
                          accessibilityRole="button"
                          accessibilityLabel={day.full}
                          accessibilityState={{ selected, disabled }}
                          aria-pressed={selected}
                          style={({ pressed }) => [
                            styles.day,
                            selected && styles.daySelected,
                            disabled && styles.dayDisabled,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayLabel,
                              selected && styles.lightText,
                            ]}
                          >
                            {day.short}
                          </Text>
                          <View style={styles.dayCheck}>
                            {selected ? (
                              <Check
                                size={18}
                                color={colors.paper}
                                aria-hidden={true}
                              />
                            ) : (
                              <View style={styles.dayDash} />
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                {step === 5 && (
                  <>
                    <View style={styles.durationRow}>
                      {[30, 45, 60].map((minutes) => (
                        <Pressable
                          key={minutes}
                          onPress={() => update("duration", minutes)}
                          accessibilityRole="button"
                          accessibilityLabel={minutes + " minutes per session"}
                          accessibilityState={{
                            selected:
                              answered.includes(5) &&
                              profile.duration === minutes,
                          }}
                          aria-pressed={
                            answered.includes(5) && profile.duration === minutes
                          }
                          style={({ pressed }) => [
                            styles.duration,
                            answered.includes(5) &&
                              profile.duration === minutes &&
                              styles.durationSelected,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.durationNumber,
                              answered.includes(5) &&
                                profile.duration === minutes &&
                                styles.lightText,
                            ]}
                          >
                            {minutes}
                          </Text>
                          <Text
                            style={[
                              styles.durationLabel,
                              answered.includes(5) &&
                                profile.duration === minutes &&
                                styles.lightText,
                            ]}
                          >
                            minutes
                          </Text>
                          {answered.includes(5) &&
                            profile.duration === minutes && (
                              <Check
                                size={15}
                                color={colors.paper}
                                style={styles.durationCheck}
                                aria-hidden={true}
                              />
                            )}
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.fieldLabel}>
                      What should we call you?{" "}
                      <Text style={styles.optional}>(optional)</Text>
                    </Text>
                    <TextInput
                      accessibilityLabel="Your first name, optional"
                      placeholder="Your first name"
                      placeholderTextColor={colors.muted}
                      value={profile.name}
                      onChangeText={(name) => update("name", name.slice(0, 40))}
                      maxLength={40}
                      autoComplete="given-name"
                      textContentType="givenName"
                      autoCapitalize="words"
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                      style={styles.nameInput}
                    />
                  </>
                )}
                {step < 6 && (
                  <Animated.View
                    style={[
                      styles.answerNote,
                      {
                        opacity: feedback.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.5, 1],
                        }),
                        transform: [
                          {
                            translateY: feedback.interpolate({
                              inputRange: [0, 1],
                              outputRange: [5, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    {blocked ? (
                      <CircleAlert
                        size={18}
                        color={colors.orangeDark}
                        style={{ marginTop: 2 }}
                        aria-hidden={true}
                      />
                    ) : (
                      <CheckCircle2
                        size={18}
                        color={colors.green}
                        style={{ marginTop: 2 }}
                        aria-hidden={true}
                      />
                    )}
                    <Text
                      style={styles.answerNoteText}
                      accessibilityLiveRegion="polite"
                    >
                      {response}
                    </Text>
                  </Animated.View>
                )}
                {step === 6 && (
                  <>
                    <View style={styles.revealPlan}>
                      <OnboardingPlanPreview
                        profile={profile}
                        confirmed={answered}
                        reducedMotion={reducedMotion}
                        expanded
                        step={step}
                      />
                    </View>
                    <Text style={styles.refineLabel}>
                      A little fine-tuning?
                    </Text>
                    <View style={styles.refineRow}>
                      {[
                        { label: "Goal", target: 1 },
                        { label: "Equipment", target: 3 },
                        { label: "Schedule", target: 4 },
                      ].map((item) => (
                        <Pressable
                          key={item.label}
                          accessibilityRole="button"
                          accessibilityLabel={
                            "Edit " + item.label.toLowerCase()
                          }
                          onPress={() => go(item.target)}
                          style={({ pressed }) => [
                            styles.refineChip,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.refineText}>{item.label}</Text>
                          <ArrowRight
                            size={14}
                            color={colors.ink}
                            aria-hidden={true}
                          />
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
            {short && step > 0 && (
              <View style={styles.inlineAction}>{primaryAction}</View>
            )}
          </Animated.View>
        </ScrollView>
        {step > 0 && !short && (
          <View style={[styles.actionDock, wide && styles.actionDockWide]}>
            <View style={styles.dockInner}>
              {!wide && step < 6 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Preview my plan"
                  accessibilityState={{ expanded: previewOpen }}
                  aria-expanded={previewOpen}
                  onPress={() => setPreviewOpen(true)}
                  style={({ pressed }) => [
                    styles.planPeek,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.peekIcon}>
                    <Dumbbell
                      size={21}
                      color={colors.green}
                      aria-hidden={true}
                    />
                  </View>
                  <View style={styles.choiceText}>
                    <Text style={styles.peekEyebrow}>
                      YOUR PLAN, TAKING SHAPE
                    </Text>
                    <Animated.Text
                      style={[
                        styles.peekText,
                        {
                          opacity: feedback.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.55, 1],
                          }),
                        },
                      ]}
                    >
                      {previewSummary}
                    </Animated.Text>
                  </View>
                  <ChevronUp size={18} color={colors.ink} aria-hidden={true} />
                </Pressable>
              )}
              {primaryAction}
              <Text style={styles.actionHint}>
                {step === 6
                  ? "Your pace. Your progress. Let’s begin."
                  : "You can change these choices anytime."}
              </Text>
            </View>
          </View>
        )}
        {short && step > 0 && step < 6 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Preview my plan"
            onPress={() => setPreviewOpen(true)}
            style={styles.landscapePreview}
          >
            <Text style={styles.refineText}>Preview my plan</Text>
            <ChevronUp size={16} color={colors.ink} aria-hidden={true} />
          </Pressable>
        )}
      </View>
      <Sheet
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Your plan preview"
      >
        <OnboardingPlanPreview
          profile={profile}
          confirmed={answered}
          reducedMotion={reducedMotion}
          expanded
          step={step}
        />
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  studioPane: { width: "43%", flexGrow: 0, backgroundColor: colors.dark },
  studioContent: { padding: 36, gap: 24, flexGrow: 1 },
  studioHero: { flexDirection: "row", alignItems: "center", gap: 20 },
  studioHeading: { flex: 1, minWidth: 0 },
  studioEyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.cream,
    marginBottom: 14,
  },
  studioTitle: {
    fontFamily: fonts.heavy,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -1.5,
    color: colors.paper,
  },
  studioTitleNarrow: { fontSize: 30, lineHeight: 38 },
  studioFootnote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.cream,
    textAlign: "center",
  },
  progressInset: { paddingHorizontal: 24 },
  progressInsetWide: { paddingHorizontal: 40 },
  questionTitleWide: { fontSize: 42, lineHeight: 50, letterSpacing: -1.8 },
  welcomeEmblem: { alignSelf: "flex-start", marginBottom: 24 },
  welcomeMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 24,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.green,
  },
  answerNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingTop: 21,
    minHeight: 65,
  },
  answerNoteText: {
    flex: 1,
    fontFamily: fonts.regular,
    color: colors.green,
    fontSize: 13,
    lineHeight: 21,
  },
  revealEmblem: { alignSelf: "flex-start", marginBottom: 20 },
  revealPlan: { marginTop: 24 },
  refineLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.muted,
    marginTop: 24,
  },
  refineRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  refineChip: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    backgroundColor: colors.paper,
  },
  refineText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
  },
  actionDock: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  actionDockWide: { paddingHorizontal: 40, paddingTop: 20, paddingBottom: 22 },
  dockInner: { maxWidth: 520, width: "100%", alignSelf: "center" },
  planPeek: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
  },
  peekIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.sage,
  },
  peekEyebrow: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.3,
    lineHeight: 16,
    color: colors.green,
  },
  peekText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 21,
    color: colors.ink,
  },
  inlineAction: { marginTop: 24, marginBottom: 12 },
  landscapePreview: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  root: { flex: 1, flexDirection: "row", backgroundColor: colors.bg },
  campaign: { width: "45%", backgroundColor: colors.dark },
  campaignImage: { opacity: 0.95, width: "100%", height: "100%" },
  campaignGradient: { flex: 1, padding: 42, justifyContent: "space-between" },
  campaignBottom: { paddingTop: 180 },
  campaignTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 20,
  },
  campaignTagText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.cream,
  },
  campaignTitle: {
    fontFamily: fonts.heavy,
    fontSize: 50,
    lineHeight: 57,
    letterSpacing: -2.4,
    color: colors.paper,
  },
  campaignBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.cream,
    marginTop: 21,
  },
  campaignFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 48,
    paddingTop: 24,
  },
  campaignFootnote: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.cream,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    flexDirection: "row",
    gap: 3,
    height: 26,
    alignItems: "center",
    transform: [{ skewX: "-17deg" }],
  },
  brandBar: { width: 5, borderRadius: 1 },
  brand: {
    fontFamily: fonts.heavy,
    fontSize: 21,
    letterSpacing: 3,
    color: colors.ink,
  },
  orangeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.orange,
  },
  formPane: { flex: 1, minWidth: 0 },
  formPaneWide: { width: "55%" },
  topbar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 14,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  topbarWide: { paddingHorizontal: 40, paddingTop: 22, paddingBottom: 12 },
  topbarNote: {
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 15,
    letterSpacing: 1.4,
    color: colors.muted,
    flexShrink: 1,
    textAlign: "right",
  },
  back: {
    minHeight: 48,
    paddingRight: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  backText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  scroller: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
  },
  scrollContentWide: {
    paddingHorizontal: 40,
    paddingVertical: 36,
    justifyContent: "center",
  },
  content: { width: "100%", maxWidth: 520, alignSelf: "center" },
  mobileHero: {
    height: 190,
    backgroundColor: colors.dark,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
  },
  mobileHeroImage: { borderRadius: 20, width: "100%", height: "100%" },
  mobileHeroGradient: { flex: 1, justifyContent: "flex-end", padding: 18 },
  photoEmblem: { position: "absolute", top: 14, left: 14 },
  photoTag: { flexDirection: "row", gap: 8, alignItems: "center" },
  photoTagText: {
    fontFamily: fonts.bold,
    color: colors.paper,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.8,
    lineHeight: 17,
    color: colors.orangeDark,
    marginBottom: 15,
  },
  welcomeTitle: {
    fontFamily: fonts.heavy,
    fontSize: 41,
    lineHeight: 47,
    letterSpacing: -1.9,
    color: colors.ink,
  },
  welcomeTitleWide: { fontSize: 57, lineHeight: 64, letterSpacing: -2.8 },
  orangeText: { color: colors.orangeDark },
  introBody: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 26,
    color: colors.muted,
    marginTop: 20,
    maxWidth: 405,
  },
  progress: { flexDirection: "row", gap: 6, marginBottom: 10 },
  progressPart: {
    flex: 1,
    height: 4,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.line,
  },
  progressPartActive: { backgroundColor: colors.orangeDark, borderRadius: 4 },
  title: {
    fontFamily: fonts.heavy,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -1.4,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 25,
    color: colors.muted,
    marginTop: 15,
  },
  choiceList: { gap: 12, marginTop: 26 },
  choice: {
    minHeight: 91,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  choiceSelected: {
    borderColor: colors.orangeDark,
    backgroundColor: colors.paleOrange,
  },
  choiceIcon: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceIconSelected: { backgroundColor: colors.paper },
  choiceText: { flex: 1, minWidth: 0 },
  choiceTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 23,
    color: colors.ink,
  },
  choiceDetail: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 3,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    backgroundColor: colors.orangeDark,
    borderColor: colors.orangeDark,
  },
  daysGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 32 },
  day: {
    width: "22%",
    minHeight: 88,
    borderRadius: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  daySelected: { backgroundColor: colors.dark, borderColor: colors.dark },
  dayDisabled: { opacity: 0.5 },
  dayLabel: {
    fontFamily: fonts.bold,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  dayCheck: { height: 19, justifyContent: "center", alignItems: "center" },
  dayDash: { height: 2, width: 10, backgroundColor: colors.line },
  durationRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 30,
    marginBottom: 32,
  },
  duration: {
    flex: 1,
    minHeight: 114,
    paddingVertical: 21,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  durationSelected: { backgroundColor: colors.dark, borderColor: colors.dark },
  durationNumber: { fontFamily: fonts.heavy, fontSize: 29, color: colors.ink },
  durationLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    marginTop: 5,
    color: colors.muted,
  },
  durationCheck: { position: "absolute", top: 10, right: 10 },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 23,
    color: colors.ink,
    marginBottom: 10,
  },
  optional: { fontFamily: fonts.regular, color: colors.muted },
  nameInput: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: 13,
    paddingHorizontal: 17,
    paddingVertical: 15,
    backgroundColor: colors.paper,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  introActions: { marginTop: 32 },
  primary: {
    minHeight: 59,
    paddingHorizontal: 23,
    paddingVertical: 17,
    borderRadius: 14,
    backgroundColor: colors.orangeDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  primaryPressed: { backgroundColor: colors.ink },
  primaryDisabled: { backgroundColor: colors.muted, opacity: 0.55 },
  primaryText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 23,
    color: colors.paper,
    flexShrink: 1,
  },
  actionHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
    marginTop: 13,
  },
  explore: {
    minHeight: 48,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: 22,
    marginTop: 7,
  },
  exploreText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  lightText: { color: colors.paper },
  pressed: { opacity: 0.72 },
});
