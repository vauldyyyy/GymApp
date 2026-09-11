import type {
  CustomerInfo,
  Package,
  Purchases,
} from "@revenuecat/purchases-js";
import type { SubscriptionOffer } from "./membership";
export type { SubscriptionOffer } from "./membership";

const publicKey = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY?.trim() || "";
const entitlement =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT?.trim() || "forma_pro";
export const purchasesSupported =
  Boolean(publicKey) && !publicKey.startsWith("sk_");

let instance: Purchases | null = null;
let signedInUser: string | null = null;
let identityRevision = 0;
let queue: Promise<unknown> = Promise.resolve();
let transactionPending = false;
const displayedPackages = new Map<string, Package>();
const listeners = new Set<(active: boolean) => void>();

function serial<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function activePro(info: CustomerInfo): boolean {
  return info.entitlements.active[entitlement]?.isActive === true;
}

function deliver(active: boolean): void {
  listeners.forEach((listener) => {
    try {
      listener(active);
    } catch {
      /* View owns rendering errors. */
    }
  });
}

async function configure(initialUserId?: string | null): Promise<Purchases> {
  if (!purchasesSupported)
    throw new Error(
      "Web checkout is not connected yet. Your training remains available.",
    );
  if (instance) return instance;
  // Import only in a configured browser. Native builds never load this SDK.
  const { Purchases: SDK } = await import("@revenuecat/purchases-js");
  const userId = initialUserId || SDK.generateRevenueCatAnonymousAppUserId();
  instance = SDK.isConfigured()
    ? SDK.getSharedInstance()
    : SDK.configure({ apiKey: publicKey, appUserId: userId });
  signedInUser = initialUserId || null;
  if (instance.getAppUserId() !== userId) await instance.changeUser(userId);
  return instance;
}

/** undefined preserves billing identity; null switches to a fresh anonymous identity. */
export async function initializePurchases(
  userId?: string | null,
): Promise<void> {
  if (!purchasesSupported) return;
  if (typeof userId === "string" && !userId.trim())
    throw new Error("A FORMA account is required for membership.");
  const requestedId = typeof userId === "string" ? userId.trim() : userId;
  const revision =
    requestedId === undefined ? identityRevision : ++identityRevision;
  return serial(async () => {
    const purchases = await configure(requestedId);
    if (requestedId !== undefined && requestedId !== signedInUser) {
      const { Purchases: SDK } = await import("@revenuecat/purchases-js");
      displayedPackages.clear();
      await purchases.changeUser(
        requestedId || SDK.generateRevenueCatAnonymousAppUserId(),
      );
      signedInUser = requestedId;
    }
    const active = signedInUser
      ? activePro(await purchases.getCustomerInfo())
      : false;
    if (revision === identityRevision) deliver(active);
  });
}

export async function getSubscriptionOffers(): Promise<SubscriptionOffer[]> {
  if (!purchasesSupported) return [];
  return serial(async () => {
    const purchases = await configure();
    displayedPackages.clear();
    const offerings = await purchases.getOfferings();
    const offers: SubscriptionOffer[] = [];
    for (const item of offerings.current?.availablePackages || []) {
      const product = item.webBillingProduct;
      if (!product.period || !product.defaultSubscriptionOption) continue;
      const count = product.period.number;
      const unit = product.period.unit;
      const period = count === 1 ? unit : count + " " + unit + "s";
      offers.push({
        id: item.identifier,
        title: product.title,
        price: product.price.formattedPrice,
        period,
        amount: product.price.amountMicros / 1_000_000,
        currency: product.price.currency,
        months:
          unit === "year" ? count * 12 : unit === "month" ? count : undefined,
        description:
          product.price.formattedPrice +
          " billed every " +
          period +
          ". Checkout confirms taxes, renewal terms, and any eligible offers.",
      });
      displayedPackages.set(item.identifier, item);
    }
    return offers;
  });
}

function requireAccount(): void {
  if (!signedInUser)
    throw new Error(
      "Sign in to your FORMA account before checking out or restoring access.",
    );
}

export async function purchaseSubscription(
  identifier: string,
): Promise<boolean> {
  if (transactionPending)
    throw new Error("Another subscription action is already in progress.");
  transactionPending = true;
  try {
    return await serial(async () => {
      const purchases = await configure();
      requireAccount();
      const item = displayedPackages.get(identifier);
      if (!item)
        throw new Error(
          "Reopen membership plans to refresh the available prices.",
        );
      const revision = identityRevision;
      try {
        // Mount inside the RN Web modal so its focus trap does not steal focus
        // from checkout inputs in a separate document-body portal.
        const htmlTarget =
          typeof document !== "undefined"
            ? document.getElementById("forma-checkout-target")
            : null;
        const result = await purchases.purchase({
          rcPackage: item,
          htmlTarget: htmlTarget || undefined,
        });
        const active = activePro(result.customerInfo);
        if (revision === identityRevision) deliver(active);
        return revision === identityRevision && active;
      } catch (error) {
        const { PurchasesError, ErrorCode } =
          await import("@revenuecat/purchases-js");
        if (
          error instanceof PurchasesError &&
          error.errorCode === ErrorCode.UserCancelledError
        )
          return false;
        throw error;
      }
    });
  } finally {
    transactionPending = false;
  }
}

// Web memberships belong to a FORMA account; refreshing its entitlements restores access.
export async function restoreSubscriptions(): Promise<boolean> {
  const revision = identityRevision;
  return serial(async () => {
    const purchases = await configure();
    requireAccount();
    const active = activePro(await purchases.getCustomerInfo());
    if (revision === identityRevision) deliver(active);
    return revision === identityRevision && active;
  });
}

export async function hasPro(): Promise<boolean> {
  if (!purchasesSupported) return false;
  return serial(async () => {
    const purchases = await configure();
    return signedInUser ? activePro(await purchases.getCustomerInfo()) : false;
  });
}

export async function getSubscriptionManagementURL(): Promise<string | null> {
  return serial(async () => {
    const purchases = await configure();
    requireAccount();
    return (await purchases.getCustomerInfo()).managementURL;
  });
}

export function subscribePurchases(
  listener: (active: boolean) => void,
): () => void {
  let alive = true;
  const deliverOne = (value: boolean) => {
    if (alive) listener(value);
  };
  const refresh = () => {
    const revision = identityRevision;
    if (purchasesSupported && instance)
      void hasPro()
        .then((value) => {
          if (revision === identityRevision) deliverOne(value);
        })
        .catch(() => {
          /* Keep the current verified access on transient network errors. */
        });
  };
  listeners.add(deliverOne);
  refresh();
  if (typeof window !== "undefined") window.addEventListener("focus", refresh);
  return () => {
    alive = false;
    listeners.delete(deliverOne);
    if (typeof window !== "undefined")
      window.removeEventListener("focus", refresh);
  };
}
