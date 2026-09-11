import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  ImageBackground,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Layers3,
  LockKeyhole,
  Sparkles,
  X,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../store";
import { colors as c, fonts as f } from "../theme";
import { Button, Eyebrow, Title, Txt } from "./UI";
import {
  annualSaving,
  isPreviewAvailable,
  monthlyEquivalent,
  PREVIEW_OFFERS,
  type SubscriptionOffer,
} from "../lib/membership";
import {
  getSubscriptionManagementURL,
  getSubscriptionOffers,
  initializePurchases,
  purchaseSubscription,
  purchasesSupported,
  restoreSubscriptions,
} from "../lib/purchases";

const benefits = [
  {
    icon: CalendarDays,
    title: "A plan that moves with you",
    text: "Your next week responds to the training you actually complete.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Know what to do next",
    text: "Get exercise progression suggestions from your logged sets.",
  },
  {
    icon: Dumbbell,
    title: "Make every session your own",
    text: "Build custom routines with the exercises you want.",
  },
  {
    icon: Layers3,
    title: "Keep your whole collection",
    text: "Save unlimited workouts, ready whenever you are.",
  },
];

function PlanOption({
  offer,
  chosen,
  offers,
  onChoose,
  reduce,
}: {
  offer: SubscriptionOffer;
  chosen: boolean;
  offers: SubscriptionOffer[];
  onChoose: () => void;
  reduce: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!chosen || reduce) {
      scale.setValue(1);
      return;
    }
    scale.setValue(0.985);
    Animated.spring(scale, {
      toValue: 1,
      stiffness: 340,
      damping: 22,
      mass: 0.8,
      useNativeDriver: Platform.OS !== "web",
    }).start();
    return () => scale.stopAnimation();
  }, [chosen, reduce]);
  const saving = annualSaving(offer, offers);
  const equivalent = monthlyEquivalent(offer);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: chosen }}
        aria-checked={chosen}
        accessibilityLabel={
          (offer.months === 12
            ? "Yearly"
            : offer.months === 1
              ? "Monthly"
              : offer.title) +
          " plan, " +
          offer.price +
          " per " +
          offer.period
        }
        onPress={onChoose}
        style={({ pressed }) => ({
          borderWidth: 2,
          borderColor: chosen ? c.green : c.line,
          borderRadius: 17,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: chosen ? c.sage : c.paper,
          opacity: pressed ? 0.8 : 1,
          minHeight: 88,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: chosen ? 0 : 1.5,
              borderColor: c.muted,
              backgroundColor: chosen ? c.green : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {chosen && (
              <Check aria-hidden size={14} color="white" strokeWidth={3} />
            )}
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Txt style={{ fontFamily: f.bold, fontSize: 15 }}>
                {offer.months === 12
                  ? "Yearly"
                  : offer.months === 1
                    ? "Monthly"
                    : offer.title}
              </Txt>
              {saving !== null && (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 7,
                    backgroundColor: c.green,
                  }}
                >
                  <Txt
                    style={{ color: "white", fontSize: 10, fontFamily: f.bold }}
                  >
                    SAVE {saving}%
                  </Txt>
                </View>
              )}
            </View>
            <Txt muted style={{ fontSize: 11, lineHeight: 17 }}>
              {equivalent
                ? equivalent + " / month, billed yearly"
                : "Billed every " + offer.period}
            </Txt>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Txt
              style={{
                fontFamily: f.heavy,
                fontSize: 21,
                lineHeight: 26,
                letterSpacing: -0.6,
              }}
            >
              {offer.price}
            </Txt>
            <Txt muted style={{ fontSize: 11 }}>
              /{offer.period}
            </Txt>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function PlusSheet({
  visible,
  onClose,
  pro,
  onPro,
  onAccount,
  preview = false,
  onPreview,
  onEndPreview,
  entry = "profile",
}: {
  visible: boolean;
  onClose: () => void;
  pro: boolean;
  onPro: () => void;
  onAccount: () => void;
  preview?: boolean;
  onPreview?: () => void;
  onEndPreview?: () => void;
  entry?: "onboarding" | "feature" | "profile";
}) {
  const { auth, state } = useStore();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const desktop = width >= 900;
  const [offers, setOffers] = useState<SubscriptionOffer[]>([]);
  const [chosen, setChosen] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [compare, setCompare] = useState(false);
  const [request, setRequest] = useState(0);
  const localPreview = isPreviewAvailable() && !!onPreview;
  const previewPrices = localPreview && !loading && offers.length === 0;
  const displayedOffers = previewPrices ? PREVIEW_OFFERS : offers;
  const selected =
    displayedOffers.find((offer) => offer.id === chosen) || displayedOffers[0];
  const active = pro || preview;
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduce(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setOffers([]);
    setStatus("");
    setCompare(false);
    setChosen("");
    if (!purchasesSupported) {
      setLoading(false);
      return;
    }
    setLoading(true);
    initializePurchases(auth?.user.id)
      .then(getSubscriptionOffers)
      .then((loaded) => {
        if (!alive) return;
        const sorted = [...loaded].sort(
          (a, b) => (b.months || 0) - (a.months || 0),
        );
        setOffers(sorted);
        setChosen(sorted[0]?.id || "");
        if (!sorted.length)
          setStatus(
            "Membership plans are temporarily unavailable. You can keep training for free.",
          );
      })
      .catch(() => {
        if (alive)
          setStatus(
            "We couldn't load membership plans. Check your connection and try again.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [visible, auth?.user.id, request]);

  async function checkout() {
    if (previewPrices) {
      if (isPreviewAvailable()) onPreview?.();
      return;
    }
    if (!auth) {
      onAccount();
      return;
    }
    if (!selected || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const activated = await purchaseSubscription(selected.id);
      if (activated) {
        onPro();
        setStatus("Welcome to Plus. Your membership is active.");
      } else
        setStatus(
          "Checkout closed without an active membership. You can try again whenever you're ready.",
        );
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!auth) {
      onAccount();
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const restored = await restoreSubscriptions();
      if (restored) onPro();
      setStatus(
        restored
          ? "Your Plus membership is restored."
          : "No active Plus membership was found for this account.",
      );
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function manage() {
    setBusy(true);
    setStatus("");
    try {
      const url = await getSubscriptionManagementURL();
      if (url && /^https:\/\//i.test(url)) await Linking.openURL(url);
      else
        setStatus(
          "Manage your membership through the subscription settings or receipt from the provider you paid with.",
        );
    } catch {
      setStatus(
        "Use the subscription settings or receipt from your payment provider to manage membership.",
      );
    } finally {
      setBusy(false);
    }
  }
  const close = () => {
    if (!busy) onClose();
  };
  const hero = (
    <View
      style={{
        gap: 14,
        padding: desktop ? 32 : 24,
        paddingTop: desktop ? 40 : 8,
        paddingBottom: desktop ? 36 : 26,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Sparkles size={17} color="#E8EFD9" aria-hidden />
        <Eyebrow style={{ color: "#E8EFD9", fontSize: 11 }}>FORMA PLUS</Eyebrow>
      </View>
      <Title
        style={{
          color: "white",
          fontSize: desktop ? 46 : 33,
          lineHeight: desktop ? 54 : 40,
          letterSpacing: -1.5,
        }}
      >
        {active
          ? "Welcome to your\nstronger chapter."
          : "Your ambition.\nA plan to match."}
      </Title>
      {desktop && (
        <Txt style={{ color: "#E0E6D9", fontSize: 13, lineHeight: 21 }}>
          {active
            ? "Your adaptive plan, personal routines, and progression insights are ready."
            : "Less second-guessing. More purpose in every session. Build strength on your terms."}
        </Txt>
      )}
      {desktop && (
        <View
          style={{ height: 1, backgroundColor: "#FFFFFF40", marginTop: 10 }}
        />
      )}
      {desktop && (
        <Txt style={{ color: "#E0E6D9", fontSize: 12, lineHeight: 21 }}>
          Built around {state.profile.days.length} training days a week{"\n"}and
          your goal to {state.profile.goal.toLowerCase()}.
        </Txt>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduce ? "none" : "fade"}
      onRequestClose={close}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#111A14B3",
          alignItems: "center",
          justifyContent: "center",
          padding: desktop ? 28 : 0,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 1000,
            height: desktop ? Math.min(height - 56, 840) : "100%",
            backgroundColor: c.bg,
            borderRadius: desktop ? 28 : 0,
            overflow: "hidden",
            flexDirection: desktop ? "row" : "column",
          }}
        >
          {desktop && (
            <ImageBackground
              source={require("../../assets/images/training-onboarding.png")}
              resizeMode="cover"
              imageStyle={{ width: "100%", height: "100%" }}
              style={{
                width: "42%",
                height: "100%",
                backgroundColor: c.dark,
                justifyContent: "flex-end",
              }}
            >
              <LinearGradient
                colors={["#19251C35", "#19251C99", "#19251CFA"]}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                }}
              />
              {hero}
            </ImageBackground>
          )}
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 24,
                paddingTop: desktop ? 12 : insets.top + 6,
                backgroundColor: desktop ? c.bg : c.dark,
                minHeight: 58 + (desktop ? 0 : insets.top),
              }}
            >
              <Txt
                style={{
                  fontFamily: f.bold,
                  fontSize: 11,
                  color: desktop ? c.muted : "#D6DDCF",
                  letterSpacing: 1.2,
                }}
              >
                {active
                  ? preview
                    ? "PLUS PREVIEW"
                    : "YOUR MEMBERSHIP"
                  : entry === "onboarding"
                    ? "YOUR PLAN IS READY"
                    : "GO FURTHER WITH PLUS"}
              </Txt>
              <Pressable
                onPress={close}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Close membership"
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: busy ? 0.4 : pressed ? 0.5 : 1,
                })}
              >
                <X size={21} color={desktop ? c.ink : "white"} aria-hidden />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {!desktop && (
                <View style={{ backgroundColor: c.dark }}>{hero}</View>
              )}
              <View style={{ paddingHorizontal: 24, paddingTop: 22, gap: 21 }}>
                {desktop && (
                  <View style={{ gap: 5 }}>
                    <Title style={{ fontSize: 27, lineHeight: 34 }}>
                      {active
                        ? "Everything you need to move forward."
                        : "Make room for stronger."}
                    </Title>
                    <Txt muted style={{ fontSize: 12 }}>
                      {active
                        ? "Every Plus feature is yours to explore."
                        : "One membership. Your whole training life."}
                    </Txt>
                  </View>
                )}
                <View
                  style={{
                    gap: desktop ? 18 : 12,
                    flexDirection: desktop ? "column" : "row",
                    flexWrap: "wrap",
                  }}
                >
                  {benefits.map(({ icon: Icon, title, text }, index) => (
                    <View
                      key={title}
                      style={{
                        flexDirection: "row",
                        gap: desktop ? 13 : 8,
                        width: desktop ? "100%" : "47%",
                        alignItems: "flex-start",
                      }}
                    >
                      <View
                        style={{
                          width: 35,
                          height: 35,
                          backgroundColor: c.sage,
                          borderRadius: 11,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Icon
                          size={18}
                          color={c.green}
                          strokeWidth={1.8}
                          aria-hidden
                        />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt
                          style={{
                            fontSize: 13,
                            fontFamily: f.bold,
                            lineHeight: 19,
                          }}
                        >
                          {desktop
                            ? title
                            : [
                                "Adaptive weekly plan",
                                "Progression insights",
                                "Custom routines",
                                "Unlimited saves",
                              ][index]}
                        </Txt>
                        {desktop && (
                          <Txt muted style={{ fontSize: 11, lineHeight: 17 }}>
                            {text}
                          </Txt>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
                {active ? (
                  <View
                    style={{
                      padding: 18,
                      borderRadius: 17,
                      backgroundColor: c.sage,
                      gap: 7,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Check size={18} color={c.green} aria-hidden />
                      <Txt style={{ fontFamily: f.bold }}>
                        {preview
                          ? "You're trying Plus in preview."
                          : "Your Plus membership is active."}
                      </Txt>
                    </View>
                    <Txt muted style={{ fontSize: 12 }}>
                      {preview
                        ? "No payment or subscription was created. Explore every Plus feature, then return to Free whenever you like."
                        : "Manage your billing, renewal, or cancellation with your payment provider."}
                    </Txt>
                    {preview && onEndPreview && (
                      <Button kind="ghost" onPress={onEndPreview}>
                        End preview and return to Free
                      </Button>
                    )}
                    {!preview && (
                      <Button kind="light" disabled={busy} onPress={manage}>
                        Manage membership
                      </Button>
                    )}
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {loading && (
                      <View
                        style={{
                          paddingVertical: 24,
                          alignItems: "center",
                          gap: 9,
                        }}
                      >
                        <ActivityIndicator color={c.green} />
                        <Txt muted>Finding your membership options…</Txt>
                      </View>
                    )}
                    {previewPrices && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Eyebrow style={{ color: c.green }}>
                          PREVIEW PRICES
                        </Eyebrow>
                        <Txt muted style={{ fontSize: 11 }}>
                          Illustrative · no charge
                        </Txt>
                      </View>
                    )}
                    {displayedOffers.map((offer) => (
                      <PlanOption
                        key={offer.id}
                        offer={offer}
                        chosen={selected?.id === offer.id}
                        offers={displayedOffers}
                        reduce={reduce}
                        onChoose={() => setChosen(offer.id)}
                      />
                    ))}
                    {!loading && !displayedOffers.length && (
                      <View
                        style={{
                          backgroundColor: c.sage,
                          borderRadius: 16,
                          padding: 18,
                          gap: 8,
                        }}
                      >
                        <Txt style={{ fontFamily: f.bold }}>
                          Membership checkout is coming soon.
                        </Txt>
                        <Txt muted style={{ fontSize: 12 }}>
                          Keep training with Free while membership plans become
                          available.
                        </Txt>
                      </View>
                    )}
                    {!!selected && !previewPrices && (
                      <Txt muted style={{ fontSize: 11, lineHeight: 17 }}>
                        {selected.description}
                      </Txt>
                    )}
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: compare }}
                  aria-expanded={compare}
                  onPress={() => setCompare(!compare)}
                  style={{
                    minHeight: 48,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTopWidth: 1,
                    borderTopColor: c.line,
                  }}
                >
                  <Txt style={{ fontFamily: f.bold, fontSize: 12 }}>
                    Compare Free and Plus
                  </Txt>
                  {compare ? (
                    <ChevronUp size={18} color={c.muted} aria-hidden />
                  ) : (
                    <ChevronDown size={18} color={c.muted} aria-hidden />
                  )}
                </Pressable>
                {compare && (
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: "row" }}>
                      <Txt style={{ flex: 1 }} />
                      <Txt
                        muted
                        style={{ width: 62, textAlign: "center", fontSize: 11 }}
                      >
                        FREE
                      </Txt>
                      <Txt
                        style={{
                          width: 62,
                          textAlign: "center",
                          fontSize: 11,
                          fontFamily: f.bold,
                          color: c.green,
                        }}
                      >
                        PLUS
                      </Txt>
                    </View>
                    {[
                      ["Workout logging & guides", "Yes", "Yes"],
                      ["Training history & sync", "Yes", "Yes"],
                      ["Adaptive weekly planning", "—", "Yes"],
                      ["Progression suggestions", "—", "Yes"],
                      ["Custom routines", "—", "Yes"],
                      ["Saved workouts", "3", "Unlimited"],
                    ].map(([label, free, plus]) => (
                      <View
                        key={label}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          minHeight: 30,
                        }}
                      >
                        <Txt style={{ flex: 1, fontSize: 11 }}>{label}</Txt>
                        <Txt
                          muted
                          style={{
                            width: 62,
                            textAlign: "center",
                            fontSize: 11,
                          }}
                        >
                          {free}
                        </Txt>
                        <Txt
                          style={{
                            width: 62,
                            textAlign: "center",
                            fontSize: 11,
                            color: c.green,
                            fontFamily: f.bold,
                          }}
                        >
                          {plus}
                        </Txt>
                      </View>
                    ))}
                  </View>
                )}
                {!!status && (
                  <View style={{ gap: 4 }}>
                    <Txt
                      accessibilityRole="alert"
                      style={{ fontSize: 12, color: c.green }}
                    >
                      {status}
                    </Txt>
                    {!active &&
                      !loading &&
                      purchasesSupported &&
                      !offers.length && (
                        <Button
                          kind="ghost"
                          onPress={() => setRequest(request + 1)}
                        >
                          Reload membership plans
                        </Button>
                      )}
                  </View>
                )}
                {!active && purchasesSupported && (
                  <Button
                    kind="ghost"
                    disabled={busy || loading}
                    onPress={restore}
                  >
                    {Platform.OS === "web"
                      ? "Restore membership access"
                      : "Restore purchases"}
                  </Button>
                )}
                {!active && !previewPrices && !!offers.length && (
                  <Txt muted style={{ fontSize: 10, lineHeight: 16 }}>
                    Subscriptions renew automatically until cancelled. The
                    selected price covers the billing period shown. Checkout
                    confirms payment, any taxes, and eligible trial or
                    introductory terms before you pay.
                  </Txt>
                )}
              </View>
            </ScrollView>
            <View
              style={{
                backgroundColor: c.bg,
                borderTopWidth: 1,
                borderTopColor: c.line,
                paddingHorizontal: 24,
                paddingTop: 14,
                paddingBottom: Math.max(14, insets.bottom),
                gap: 6,
              }}
            >
              {active ? (
                <Button
                  icon={<ArrowRight size={17} color="white" aria-hidden />}
                  onPress={onClose}
                >
                  Explore my Plus plan
                </Button>
              ) : (
                <>
                  {!!selected && (
                    <Button
                      disabled={busy || loading}
                      onPress={checkout}
                      icon={<ArrowRight size={17} color="white" aria-hidden />}
                    >
                      {busy
                        ? "Opening checkout…"
                        : previewPrices
                          ? "Try Plus in preview — no charge"
                          : !auth
                            ? "Sign in & continue"
                            : "Continue with " +
                              (selected.months === 12
                                ? "yearly"
                                : selected.months === 1
                                  ? "monthly"
                                  : "Plus")}
                    </Button>
                  )}
                  <Txt
                    muted
                    style={{
                      fontSize: 10,
                      lineHeight: 16,
                      textAlign: "center",
                    }}
                  >
                    {previewPrices
                      ? "No card needed. Preview mode only."
                      : selected
                        ? selected.price +
                          " / " +
                          selected.period +
                          " · Renewing subscription"
                        : "Workout logging and your history remain free."}
                  </Txt>
                  <Button
                    kind="ghost"
                    style={{ minHeight: 44 }}
                    disabled={busy}
                    onPress={onClose}
                  >
                    Continue with Free
                  </Button>
                </>
              )}
            </View>
          </View>
          {Platform.OS === "web" && (
            <View
              nativeID="forma-checkout-target"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 100,
                pointerEvents: busy ? "auto" : "none",
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
