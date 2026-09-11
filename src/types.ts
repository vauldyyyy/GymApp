export type Goal = "Build strength" | "Build muscle" | "Feel fitter";
export type Experience =
  | "Getting started"
  | "Some experience"
  | "Very experienced";
export type Equipment = "Full gym" | "Dumbbells" | "Bodyweight";
export type Profile = {
  name: string;
  goal: Goal;
  experience: Experience;
  equipment: Equipment;
  days: number[];
  duration: number;
  onboardingDone: boolean;
  unit: "kg" | "lb";
};
export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  equipment: Equipment | "Any";
  reps: string;
  sets: number;
  rest: number;
  instructions: string[];
  tip: string;
};
export type Workout = {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  minutes: number;
  exercises: string[];
  accent: string;
  prescription?: ExercisePrescription[];
  reasoning?: string[];
};
export type ExercisePrescription = {
  exerciseId: string;
  sets: number;
  reps: number;
  restSeconds: number;
};
export type LoggedSet = {
  exerciseId: string;
  index: number;
  reps: number;
  weight: number;
  done: boolean;
};
export type ActiveWorkout = {
  id: string;
  workoutId: string;
  name: string;
  startedAt: string;
  exercises: string[];
  sets: LoggedSet[];
  unit: "kg" | "lb";
  prescription?: ExercisePrescription[];
};
export type WorkoutRecord = ActiveWorkout & {
  completedAt: string;
  durationSeconds: number;
};
export type AppState = {
  version: 1;
  profile: Profile;
  history: WorkoutRecord[];
  saved: string[];
  active: ActiveWorkout | null;
};
export const defaultProfile: Profile = {
  name: "",
  goal: "Build strength",
  experience: "Getting started",
  equipment: "Full gym",
  days: [1, 3, 5],
  duration: 45,
  onboardingDone: false,
  unit: "kg",
};
