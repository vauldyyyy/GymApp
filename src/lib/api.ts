import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
export type Account = { id: string; email: string; name: string };
export type Auth = { token: string; user: Account; expiresAt?: string };
const AUTH_KEY = "forma-auth-v1";
const base = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";
export function isAuth(value: unknown): value is Auth {
  if (!value || typeof value !== "object") return false;
  const a = value as Auth;
  return (
    typeof a.token === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(a.token) &&
    !!a.user &&
    typeof a.user.id === "string" &&
    a.user.id.length > 0 &&
    typeof a.user.email === "string" &&
    typeof a.user.name === "string"
  );
}
export async function readAuth(): Promise<Auth | null> {
  const raw =
    Platform.OS === "web"
      ? sessionStorage.getItem(AUTH_KEY)
      : await SecureStore.getItemAsync(AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isAuth(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
export async function saveAuth(auth: Auth | null) {
  if (Platform.OS === "web") {
    if (auth) sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    else sessionStorage.removeItem(AUTH_KEY);
  } else {
    if (auth) await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(auth));
    else await SecureStore.deleteItemAsync(AUTH_KEY);
  }
}
export class RequestError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "request_failed",
  ) {
    super(message);
    this.name = "RequestError";
  }
}
export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${base}${path}`, {
      method: options.method || "GET",
      headers: {
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const raw = await response.text();
    let result: any = null;
    try {
      result = raw ? JSON.parse(raw) : null;
    } catch {
      throw new RequestError(
        "The account service returned an unexpected response. Your local workouts are safe.",
        response.status,
        "invalid_response",
      );
    }
    if (!response.ok)
      throw new RequestError(
        typeof result?.error === "string"
          ? result.error
          : result?.error?.message ||
              result?.message ||
              "Unable to complete the request. Please try again.",
        response.status,
        result?.error?.code,
      );
    return result as T;
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw new RequestError(
        "Unable to reach your account. Your workouts are safe on this device. Check your connection and try again.",
        0,
        "network_error",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
