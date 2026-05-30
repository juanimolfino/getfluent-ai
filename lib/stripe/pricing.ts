export const CREDIT_PACKS = [
  { id: "credits_10", credits: 10, price: 1, stripePriceEnv: "STRIPE_PRICE_ID_CREDITS_10" },
  { id: "credits_50", credits: 50, price: 2, stripePriceEnv: "STRIPE_PRICE_ID_CREDITS_50" }
] as const;

export const PLANS = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    monthlyCredits: Number(process.env.FREE_MONTHLY_CREDITS ?? 5),
    features: ["Free monthly credits", "Image generation", "Text to speech"]
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 3,
    monthlyCredits: Number(process.env.PRO_MONTHLY_CREDITS ?? 100),
    stripePriceEnv: "STRIPE_PRICE_ID_PRO_MONTHLY",
    features: ["Higher monthly credits", "Premium feature flag", "Priority generation queue"]
  }
] as const;

export function getCreditPack(id: string) {
  return CREDIT_PACKS.find((pack) => pack.id === id);
}
