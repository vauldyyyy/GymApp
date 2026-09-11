import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Home,
  Play,
  Settings2,
  Sparkles,
  User,
} from "lucide-react-native";
import { StoreProvider, useStore } from "./src/store";
import { colors as c, fonts as f } from "./src/theme";
import { Exercise, Workout, WorkoutRecord } from "./src/types";
import {
  Button,
  Eyebrow,
  FadeIn,
  IconButton,
  Txt,
  styles as u,
} from "./src/components/UI";
import Onboarding from "./src/components/Onboarding";
import WorkoutSession from "./src/components/WorkoutSession";
import Dashboard from "./src/screens/Dashboard";
import Progress from "./src/screens/Progress";
import Coach from "./src/screens/Coach";
import { isPreviewAvailable } from "./src/lib/membership";
import { Plan, Explore, ProfileScreen } from "./src/screens/Training";
import {
  AccountSheet,
  PlusSheet,
  WorkoutDetails,
  ExerciseDetails,
  FinishSheet,
  NoticeSheet,
  ErrorSheet,
} from "./src/components/Dialogs";
import {
  hasPro,
  purchasesSupported,
  subscribePurchases,
} from "./src/lib/purchases";
import { request } from "./src/lib/api";
type Page = "Today" | "My plan" | "Coach" | "Explore" | "Progress" | "Profile";
const nav = [
  { name: "Today" as Page, icon: Home },
  { name: "My plan" as Page, icon: CalendarDays },
  { name: "Coach" as Page, icon: Sparkles },
  { name: "Explore" as Page, icon: Dumbbell },
  { name: "Progress" as Page, icon: BarChart3 },
];
function Brand({ small = false }: { small?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View
        style={{
          width: 29,
          height: 29,
          flexDirection: "row",
          gap: 4,
          alignItems: "center",
          transform: [{ skewX: "-18deg" }],
        }}
      >
        <View
          style={{
            width: 7,
            height: 18,
            backgroundColor: c.orange,
            borderRadius: 1,
          }}
        />
        <View
          style={{
            width: 7,
            height: 29,
            backgroundColor: c.orange,
            borderRadius: 1,
          }}
        />
        <View
          style={{
            width: 7,
            height: 22,
            backgroundColor: c.orange,
            borderRadius: 1,
          }}
        />
      </View>
      <Txt
        style={{
          fontFamily: f.heavy,
          fontSize: small ? 22 : 26,
          lineHeight: 33,
          letterSpacing: 2,
        }}
      >
        FORMA
      </Txt>
    </View>
  );
}
export default function App() {
  const [loaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Manrope_600SemiBold,
    Manrope_800ExtraBold,
  });
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {loaded || fontError ? (
        <StoreProvider>
          <Application />
        </StoreProvider>
      ) : (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: c.bg,
          }}
        >
          <ActivityIndicator color={c.orange} />
        </View>
      )}
    </SafeAreaProvider>
  );
}
function Application() {
  const store = useStore();
  const { state, ready, auth, error, setError } = store;
  const { width } = useWindowDimensions();
  const desktop = width >= 1000;
  const mobile = width < 700;
  const [page, setPage] = useState<Page>("Today");
  const [onboard, setOnboard] = useState(false);
  const [explored, setExplored] = useState(false);
  const [session, setSession] = useState(false);
  const [selected, setSelected] = useState<Workout | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [finished, setFinished] = useState<WorkoutRecord | null>(null);
  const [account, setAccount] = useState(false);
  const [plus, setPlus] = useState(false);
  const [notice, setNotice] = useState(false);
  const [paidPro, setPro] = useState(false);
  const [paidOwner, setPaidOwner] = useState<string | null>(null);
  const [previewOwner, setPreviewOwner] = useState<string | null>(null);
  const [plusEntry, setPlusEntry] = useState<
    "onboarding" | "feature" | "profile"
  >("feature");
  const [returnToPlus, setReturnToPlus] = useState(false);
  const owner = auth?.user.id ?? "guest";
  const preview = isPreviewAvailable() && previewOwner === owner;
  const paid = paidPro && paidOwner === owner;
  const pro = paid || preview;
  function showPlus(entry: "onboarding" | "feature" | "profile" = "feature") {
    setPlusEntry(entry);
    setPlus(true);
  }
  const [toast, setToast] = useState("");
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (session) {
        setSession(false);
        return true;
      }
      if (onboard) {
        setOnboard(false);
        return true;
      }
      if (page !== "Today") {
        setPage("Today");
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [session, onboard, page]);
  useEffect(() => {
    if (!auth) {
      setPro(false);
      return;
    }
    let alive = true;
    setPaidOwner(auth.user.id);
    setPro(false);
    const unsubscribe = subscribePurchases((active) => {
      if (alive && purchasesSupported) setPro(active);
    });
    const refresh = () => {
      const check = purchasesSupported
        ? hasPro()
        : request<{ isPro: boolean }>("/api/entitlements", {
            token: auth.token,
          }).then((result) => result.isPro);
      check
        .then((active) => {
          if (alive) setPro(active);
        })
        .catch(() => {
          if (alive) setPro(false);
        });
    };
    refresh();
    const foreground = AppState.addEventListener("change", (value) => {
      if (value === "active") refresh();
    });
    return () => {
      alive = false;
      unsubscribe();
      foreground.remove();
    };
  }, [auth]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(timer);
  }, [toast]);
  function openWorkout(w: Workout) {
    if (state.active) {
      setSession(true);
      return;
    }
    setSelected(w);
  }
  function saveWorkout(id: string) {
    if (!state.saved.includes(id) && state.saved.length >= 3 && !pro) {
      showPlus();
      return;
    }
    store.toggleSaved(id);
  }
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={c.orange} />
      </View>
    );
  if (onboard || (!state.profile.onboardingDone && !explored))
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <Onboarding
          initial={state.profile}
          onComplete={(profile) => {
            const firstSetup = !state.profile.onboardingDone;
            store.setProfile(profile);
            setOnboard(false);
            setExplored(true);
            if (firstSetup && !pro) showPlus("onboarding");
            else setToast("Your plan has been updated from your choices.");
          }}
          onExit={() => {
            setOnboard(false);
            setExplored(true);
          }}
          onSignIn={!auth ? () => setAccount(true) : undefined}
        />
        <AccountSheet
          visible={account}
          onClose={() => setAccount(false)}
          onSuccess={() => {
            setAccount(false);
            setExplored(true);
            setOnboard(false);
          }}
          defaultMode="login"
        />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        {desktop && (
          <ScrollView
            style={{
              width: 224,
              flexGrow: 0,
              backgroundColor: "#F0F1E9",
              borderRightWidth: 1,
              borderRightColor: c.line,
            }}
            contentContainerStyle={s.sidebar}
          >
            <Brand />
            <View style={{ marginTop: 50, gap: 8 }}>
              <Eyebrow
                style={{
                  color: c.muted,
                  marginLeft: 16,
                  marginBottom: 12,
                  fontSize: 9,
                }}
              >
                YOUR TRAINING SPACE
              </Eyebrow>
              {nav.map(({ name, icon: Icon }) => (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: page === name && !session }}
                  onPress={() => {
                    setPage(name);
                    setSession(false);
                  }}
                  style={({ pressed, hovered }: any) => [
                    s.navItem,
                    {
                      backgroundColor:
                        page === name && !session
                          ? c.paleOrange
                          : hovered
                            ? "#EEEFE7"
                            : "transparent",
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Icon
                    size={19}
                    strokeWidth={1.7}
                    color={page === name && !session ? c.orangeDark : c.muted}
                  />
                  <Txt
                    style={{
                      fontFamily: page === name ? f.bold : f.medium,
                      fontSize: 13,
                      color: page === name && !session ? c.orangeDark : c.muted,
                    }}
                  >
                    {name}
                  </Txt>
                  {page === name && !session && (
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: c.orange,
                        marginLeft: "auto",
                      }}
                    />
                  )}
                </Pressable>
              ))}
            </View>
            <View style={{ flex: 1 }} />
            <View style={s.sidebarNote}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <Sparkles size={18} color={c.green} />
                <Eyebrow style={{ fontSize: 9, color: c.green }}>
                  FORMA PLUS
                </Eyebrow>
              </View>
              <Txt
                style={{
                  fontFamily: f.display,
                  fontSize: 18,
                  lineHeight: 24,
                  marginTop: 14,
                }}
              >
                Training that grows with you.
              </Txt>
              <Txt muted style={{ fontSize: 11, lineHeight: 18, marginTop: 8 }}>
                Adaptive plans, progression insights and routines you make your
                own.
              </Txt>
              <Button
                kind="dark"
                onPress={() => showPlus()}
                style={{ marginTop: 18, minHeight: 43, paddingHorizontal: 14 }}
                icon={<ArrowUpRight size={14} color="white" />}
              >
                {pro ? "Your Plus" : "Explore Plus"}
              </Button>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPage("Profile");
                setSession(false);
              }}
              style={[
                u.row,
                {
                  marginTop: 24,
                  paddingTop: 24,
                  borderTopWidth: 1,
                  borderColor: c.line,
                  gap: 12,
                },
              ]}
            >
              <View style={s.avatar}>
                <Txt style={{ fontFamily: f.bold, fontSize: 14 }}>
                  {state.profile.name?.slice(0, 2).toUpperCase() || "YO"}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={{ fontFamily: f.bold, fontSize: 12 }}>
                  {state.profile.name || "Your space"}
                </Txt>
                <Txt muted style={{ fontSize: 10 }}>
                  {preview
                    ? "Plus preview · no charge"
                    : paid
                      ? "Plus member"
                      : auth
                        ? "Free member"
                        : "Local profile"}
                </Txt>
              </View>
              <Settings2 size={17} color={c.muted} />
            </Pressable>
          </ScrollView>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={[s.topbar, { paddingHorizontal: mobile ? 22 : 40 }]}>
            {desktop ? (
              <View style={u.row}>
                <Txt muted style={{ fontSize: 11 }}>
                  Your space
                </Txt>
                <ChevronRight size={13} color={c.muted} />
                <Txt style={{ fontSize: 11, fontFamily: f.medium }}>
                  {session ? "In session" : page}
                </Txt>
              </View>
            ) : (
              <Brand small />
            )}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: mobile ? 8 : 16,
              }}
            >
              {desktop && (
                <View style={u.row}>
                  <View
                    style={{
                      height: 6,
                      width: 6,
                      borderRadius: 3,
                      backgroundColor: c.green,
                    }}
                  />
                  <Txt muted style={{ fontSize: 11 }}>
                    Made for your momentum
                  </Txt>
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  preview
                    ? "View Plus preview membership"
                    : paid
                      ? "View Plus membership"
                      : "Explore FORMA Plus"
                }
                onPress={() => showPlus()}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 13,
                  borderRadius: 24,
                  backgroundColor: c.sage,
                  justifyContent: "center",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Sparkles size={14} color={c.green} />
                <Txt
                  style={{ fontFamily: f.bold, color: c.green, fontSize: 11 }}
                >
                  {preview ? "Preview" : paid ? "Plus" : "Get Plus"}
                </Txt>
              </Pressable>
              <IconButton
                label="Training updates"
                onPress={() => setNotice(true)}
                icon={<Bell size={18} color={c.ink} />}
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: "transparent",
                }}
              />
              {!desktop && (
                <IconButton
                  label="Your profile"
                  onPress={() => {
                    setPage("Profile");
                    setSession(false);
                  }}
                  icon={<User size={18} color={c.ink} />}
                  style={{ width: 40, height: 40, backgroundColor: c.sage }}
                />
              )}
            </View>
          </View>
          {preview && (
            <View
              style={{
                backgroundColor: "#E5ECD9",
                paddingHorizontal: mobile ? 22 : 40,
                paddingVertical: 9,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Txt style={{ color: c.green, fontSize: 11, flex: 1 }}>
                Plus preview is on for this visit. No subscription or charge.
              </Txt>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setPreviewOwner(null);
                  setToast(
                    "Back to the free experience. Your saved training stays here.",
                  );
                }}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 8,
                }}
              >
                <Txt
                  style={{ fontFamily: f.bold, fontSize: 11, color: c.green }}
                >
                  Exit preview
                </Txt>
              </Pressable>
            </View>
          )}
          <ScrollView
            key={page + "-" + session}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: mobile ? 22 : 40,
              paddingTop: mobile ? 24 : 30,
              paddingBottom: desktop ? 30 : 100,
              alignItems: "center",
            }}
          >
            <View style={{ width: "100%", maxWidth: 1280 }}>
              {session && state.active ? (
                <WorkoutSession
                  onClose={() => setSession(false)}
                  onFinished={(record) => {
                    setSession(false);
                    setFinished(record);
                    setPage("Progress");
                  }}
                />
              ) : (
                <FadeIn key={page}>
                  {page === "Today" && (
                    <Dashboard
                      pro={pro}
                      onCoach={() => setPage("Coach")}
                      onWorkout={openWorkout}
                      onPlan={() => setPage("Explore")}
                      onProgress={() => setPage("Progress")}
                      onOnboard={() => setOnboard(true)}
                    />
                  )}
                  {page === "My plan" && (
                    <Plan
                      pro={pro}
                      onCoach={() => setPage("Coach")}
                      onWorkout={openWorkout}
                      onEdit={() => setOnboard(true)}
                    />
                  )}
                  {page === "Coach" && (
                    <Coach
                      pro={pro}
                      preview={preview}
                      onUpgrade={() => showPlus()}
                      onWorkout={openWorkout}
                      onEdit={() => setOnboard(true)}
                    />
                  )}
                  {page === "Explore" && (
                    <Explore
                      onWorkout={openWorkout}
                      onExercise={setExercise}
                      onSave={saveWorkout}
                    />
                  )}
                  {page === "Progress" && <Progress />}
                  {page === "Profile" && (
                    <ProfileScreen
                      onAccount={() => setAccount(true)}
                      onPlus={() => showPlus("profile")}
                      onEdit={() => setOnboard(true)}
                      pro={pro}
                      preview={preview}
                      onNotice={setToast}
                    />
                  )}
                </FadeIn>
              )}
            </View>
          </ScrollView>
          {!desktop && (
            <View style={s.bottomnav}>
              {nav.map(({ name, icon: Icon }) => (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: page === name && !session }}
                  onPress={() => {
                    setPage(name);
                    setSession(false);
                  }}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    minHeight: 64,
                  }}
                >
                  <Icon
                    size={21}
                    color={page === name && !session ? c.orangeDark : c.muted}
                    strokeWidth={page === name ? 2 : 1.7}
                  />
                  <Txt
                    style={{
                      fontSize: 10,
                      fontFamily: page === name ? f.bold : f.medium,
                      color: page === name && !session ? c.orangeDark : c.muted,
                    }}
                  >
                    {name}
                  </Txt>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
      {state.active && !session && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setSession(true)}
          style={{
            position: "absolute",
            bottom: desktop ? 24 : 80,
            left: desktop ? 258 : 20,
            right: 24,
            maxWidth: 440,
            padding: 16,
            backgroundColor: c.dark,
            borderRadius: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 13,
            boxShadow: "0px 8px 30px #00000020",
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 20,
              backgroundColor: "#FFFFFF18",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Play size={16} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontFamily: f.bold, fontSize: 12, color: "white" }}>
              Your workout is waiting
            </Txt>
            <Txt style={{ fontSize: 11, color: "#D7DED2" }}>
              {state.active.name}
            </Txt>
          </View>
          <ArrowRight size={18} color="white" />
        </Pressable>
      )}
      <WorkoutDetails
        workout={selected}
        onClose={() => setSelected(null)}
        onExercise={setExercise}
        onStart={() => {
          if (selected) {
            store.startWorkout(selected);
            setSelected(null);
            setSession(true);
          }
        }}
      />
      <ExerciseDetails exercise={exercise} onClose={() => setExercise(null)} />
      <FinishSheet record={finished} onClose={() => setFinished(null)} />
      <NoticeSheet
        visible={notice}
        onClose={() => setNotice(false)}
        onPlan={() => {
          setNotice(false);
          setPage("My plan");
          setSession(false);
        }}
      />
      <AccountSheet
        visible={account}
        onClose={() => setAccount(false)}
        onSuccess={() => {
          setAccount(false);
          if (returnToPlus) {
            setReturnToPlus(false);
            setPlus(true);
          }
          setToast("You’re connected. Your training has a home.");
        }}
      />
      <PlusSheet
        visible={plus}
        onClose={() => setPlus(false)}
        pro={paid}
        preview={preview}
        entry={plusEntry}
        onPreview={() => {
          if (!isPreviewAvailable()) return;
          setPreviewOwner(owner);
          setPlus(false);
          setPage("Coach");
          setSession(false);
        }}
        onEndPreview={() => setPreviewOwner(null)}
        onPro={() => {
          setPaidOwner(owner);
          setPro(true);
        }}
        onAccount={() => {
          setReturnToPlus(true);
          setPlus(false);
          setAccount(true);
        }}
      />
      <ErrorSheet error={error} onClose={() => setError("")} />
      {!!toast && (
        <View
          style={{
            pointerEvents: "none",
            position: "absolute",
            bottom: desktop ? 28 : 88,
            alignSelf: "center",
            backgroundColor: c.ink,
            paddingVertical: 13,
            paddingHorizontal: 20,
            borderRadius: 30,
            maxWidth: "90%",
          }}
        >
          <Txt style={{ color: "white", fontSize: 12, textAlign: "center" }}>
            {toast}
          </Txt>
        </View>
      )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  sidebar: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 24,
  },
  navItem: {
    minHeight: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 13,
  },
  sidebarNote: { backgroundColor: "#E4E8D9", borderRadius: 17, padding: 18 },
  avatar: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: "#DADFCF",
    alignItems: "center",
    justifyContent: "center",
  },
  topbar: {
    height: 80,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomnav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F6F5F0",
    borderTopWidth: 1,
    borderTopColor: c.line,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
});
