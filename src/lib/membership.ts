import { Platform } from "react-native";

export type SubscriptionOffer = {
  id: string;
  title: string;
  price: string;
  period: string;
  description: string;
  amount?: number;
  currency?: string;
  months?: number;
};

export type MembershipStatus = "free" | "preview" | "paid";

// These prices exist solely to review the paywall on the local development app.
// RevenueCat offerings are the only source of purchasable prices.
export const PREVIEW_OFFERS: SubscriptionOffer[] = [
  {
    id: "preview_annual",
    title: "Yearly",
    price: "₹1,999",
    period: "year",
    description: "₹1,999 billed yearly · illustrative price",
    amount: 1999,
    currency: "INR",
    months: 12,
  },
  {
    id: "preview_monthly",
    title: "Monthly",
    price: "₹399",
    period: "month",
    description: "₹399 billed monthly · illustrative price",
    amount: 399,
    currency: "INR",
    months: 1,
  },
];

export function isPreviewAvailable(): boolean {
  if (typeof __DEV__ === "undefined" || !__DEV__ || Platform.OS !== "web")
    return false;
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
    window.location.hostname,
  );
}

export function monthlyEquivalent(offer: SubscriptionOffer): string | null {
  if (!offer.amount || !offer.months || offer.months <= 1 || !offer.currency)
    return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: offer.currency,
      maximumFractionDigits: 2,
    }).format(offer.amount / offer.months);
  } catch {
    return null;
  }
}

export function annualSaving(
  offer: SubscriptionOffer,
  offers: SubscriptionOffer[],
): number | null {
  const monthly = offers.find(
    (item) => item.months === 1 && item.currency === offer.currency,
  );
  if (offer.months !== 12 || !offer.amount || !monthly?.amount) return null;
  const saving = Math.round((1 - offer.amount / (monthly.amount * 12)) * 100);
  return saving > 0 ? saving : null;
}
