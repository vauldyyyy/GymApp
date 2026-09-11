import { useEffect, useState } from "react";
import { AppState } from "react-native";

/** Refresh calendar-driven screens at local midnight and when returning to the app. */
export function useTrainingClock(): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      clearTimeout(timer);
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 30);
      timer = setTimeout(() => {
        setRevision((value) => value + 1);
        scheduleMidnight();
      }, midnight.getTime() - now.getTime());
    };
    scheduleMidnight();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setRevision((value) => value + 1);
        scheduleMidnight();
      }
    });
    return () => {
      clearTimeout(timer);
      listener.remove();
    };
  }, []);
  return revision;
}
