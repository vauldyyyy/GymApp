import { NativeModules, Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";

import type { SubscriptionOffer } from "./membership";
export type { SubscriptionOffer } from "./membership";

// Expo Go's RevenueCat preview API can return mock data. Never use it for access.
export const purchasesSupported =
  (Platform.OS === "ios" || Platform.OS === "android") &&
  Boolean(NativeModules.RNPurchases);

const entitlement =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT?.trim() || "forma_pro";
let configured = false;
let operationQueue: Promise<unknown> = Promise.resolve();
let transactionPending = false;
let identityRevision = 0;
const displayedPackages = new Map<string, PurchasesPackage>();
const subscriptionRefreshers = new Set<() => void>();

function refreshSubscribers(): void {
  subscriptionRefreshers.forEach((refresh) => refresh());
}

function serial<T>(operation: () => Promise<T>): Promise<T> {
  // An identity change must not happen while a store transaction is in progress.
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function platformKey(): string {
  if (!purchasesSupported) {
    throw new Error(
      "Subscriptions require the FORMA iOS or Android development or store build. Billing is unavailable in Expo Go.",
    );
  }
  const variable =
    Platform.OS === "ios"
      ? "EXPO_PUBLIC_REVENUECAT_IOS_KEY"
      : "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY";
  // Expo only inlines environment variables accessed with this literal syntax.
  const key = (
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
  )?.trim();
  if (!key) {
    throw new Error(
      `Subscriptions are not configured. Set ${variable} to the RevenueCat public SDK key, then rebuild the app.`,
    );
  }
  if (key.startsWith("sk_")) {
    throw new Error(
      `${variable} must contain a public SDK key. Keep RevenueCat secret API keys on the server.`,
    );
  }
  return key;
}

async function configureIfNeeded(initialUserId?: string | null): Promise<void> {
  const apiKey = platformKey();
  if (configured) return;
  if (!(await Purchases.isConfigured())) {
    Purchases.configure({ apiKey, appUserID: initialUserId || undefined });
  }
  // Also handles a native SDK that remained configured through a JS fast refresh.
  await Purchases.getAppUserID();
  configured = true;
  refreshSubscribers();
}

/** undefined keeps the current identity; null explicitly signs the billing user out. */
export async function initializePurchases(
  userId?: string | null,
): Promise<void> {
  if (typeof userId === "string" && !userId.trim()) {
    throw new Error(
      "A non-empty FORMA account ID is required to identify subscriptions.",
    );
  }
  const requestedUserId = typeof userId === "string" ? userId.trim() : userId;
  if (requestedUserId !== undefined) identityRevision += 1;
  return serial(async () => {
    await configureIfNeeded(requestedUserId);
    if (requestedUserId === undefined) return;
    if (requestedUserId === null) {
      if (!(await Purchases.isAnonymous())) {
        displayedPackages.clear();
        await Purchases.logOut();
      }
      refreshSubscribers();
      return;
    }
    if ((await Purchases.getAppUserID()) !== requestedUserId) {
      displayedPackages.clear();
      await Purchases.logIn(requestedUserId);
    }
    refreshSubscribers();
  });
}

function activePro(info: CustomerInfo): boolean {
  return info.entitlements.active[entitlement]?.isActive === true;
}

async function requireAccount(): Promise<void> {
  if (await Purchases.isAnonymous()) {
    throw new Error(
      "Sign in to your FORMA account before purchasing or restoring a subscription.",
    );
  }
}

function billingPeriod(isoPeriod: string): string {
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(
    isoPeriod,
  );
  if (!match) {
    throw new Error(
      "The store returned an unsupported subscription period. Please reload plans or contact support.",
    );
  }
  const units = ["year", "month", "week", "day"];
  const parts = units.flatMap((unit, index) => {
    const count = Number(match[index + 1] || 0);
    return count > 0
      ? [`${count === 1 ? "" : `${count} `}${unit}${count === 1 ? "" : "s"}`]
      : [];
  });
  if (!parts.length)
    throw new Error(
      "The store returned a subscription without a billing period.",
    );
  return parts.join(" and ");
}

export async function getSubscriptionOffers(): Promise<SubscriptionOffer[]> {
  return serial(async () => {
    await configureIfNeeded();
    // Clear before fetching so a failed refresh cannot leave purchasable stale offers.
    displayedPackages.clear();
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    const offers: SubscriptionOffer[] = [];
    const nextPackages = new Map<string, PurchasesPackage>();
    for (const item of packages) {
      // FORMA's paywall supports subscriptions; never label a one-time item as recurring.
      if (!item.product.subscriptionPeriod) continue;
      const period = billingPeriod(item.product.subscriptionPeriod);
      offers.push({
        id: item.identifier,
        title: item.product.title,
        price: item.product.priceString,
        period,
        amount: item.product.price,
        currency: item.product.currencyCode,
        months:
          item.product.subscriptionPeriod === "P1Y"
            ? 12
            : item.product.subscriptionPeriod === "P1M"
              ? 1
              : undefined,
        description: `Regular price: ${item.product.priceString} per ${period}. The store confirms payment and renewal terms before purchase.`,
      });
      nextPackages.set(item.identifier, item);
    }
    nextPackages.forEach((item, identifier) =>
      displayedPackages.set(identifier, item),
    );
    return offers;
  });
}

function wasCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "userCancelled" in error &&
    error.userCancelled === true
  );
}

/** Returns false when cancelled or when the returned customer has no active Pro entitlement. */
export async function purchaseSubscription(
  identifier: string,
): Promise<boolean> {
  if (transactionPending)
    throw new Error("Another subscription action is already in progress.");
  transactionPending = true;
  const revision = identityRevision;
  try {
    return await serial(async () => {
      await configureIfNeeded();
      await requireAccount();
      const item = displayedPackages.get(identifier);
      if (!item) {
        throw new Error(
          "This subscription option is no longer loaded. Reopen the plans and select an available option.",
        );
      }
      try {
        const result = await Purchases.purchasePackage(item);
        return revision === identityRevision && activePro(result.customerInfo);
      } catch (error) {
        if (wasCancelled(error)) return false;
        throw error;
      }
    });
  } finally {
    transactionPending = false;
  }
}

/** Restore only in response to an explicit user action; it may present store UI. */
export async function restoreSubscriptions(): Promise<boolean> {
  if (transactionPending)
    throw new Error("Another subscription action is already in progress.");
  transactionPending = true;
  const revision = identityRevision;
  try {
    return await serial(async () => {
      await configureIfNeeded();
      await requireAccount();
      try {
        const info = await Purchases.restorePurchases();
        return revision === identityRevision && activePro(info);
      } catch (error) {
        if (wasCancelled(error)) return false;
        throw error;
      }
    });
  } finally {
    transactionPending = false;
  }
}

export async function hasPro(): Promise<boolean> {
  return serial(async () => {
    await configureIfNeeded();
    return activePro(await Purchases.getCustomerInfo());
  });
}

export async function getSubscriptionManagementURL(): Promise<string | null> {
  return serial(async () => {
    await configureIfNeeded();
    await requireAccount();
    return (await Purchases.getCustomerInfo()).managementURL;
  });
}

/** Subscribe before or after initialization; always unsubscribe when the account/view changes. */
export function subscribePurchases(
  listener: (active: boolean) => void,
): () => void {
  let alive = true;
  let refreshing = false;
  let refreshAgain = false;
  const deliver = (value: boolean) => {
    if (!alive) return;
    // A view callback must not turn a successful store operation into a rejection.
    try {
      listener(value);
    } catch {
      /* The owner handles its rendering errors. */
    }
  };
  const refresh = () => {
    if (!alive || !configured) return;
    if (refreshing) {
      refreshAgain = true;
      return;
    }
    refreshing = true;
    const revision = identityRevision;
    // Fetch the SDK's current customer after queued identity changes, rather than
    // trusting an event payload that may have been queued for the previous user.
    void hasPro()
      .then((value) => {
        if (revision === identityRevision) deliver(value);
      })
      .catch(() => {
        if (revision === identityRevision) deliver(false);
      })
      .finally(() => {
        refreshing = false;
        if (refreshAgain) {
          refreshAgain = false;
          refresh();
        }
      });
  };
  // Ignore notifications produced by the in-flight read itself.
  const customerInfoUpdated = () => {
    if (!refreshing) refresh();
  };
  deliver(false);
  if (!purchasesSupported)
    return () => {
      alive = false;
    };
  // RevenueCat allows listeners to be registered before configure().
  Purchases.addCustomerInfoUpdateListener(customerInfoUpdated);
  subscriptionRefreshers.add(refresh);
  refresh();
  return () => {
    alive = false;
    subscriptionRefreshers.delete(refresh);
    Purchases.removeCustomerInfoUpdateListener(customerInfoUpdated);
  };
}
