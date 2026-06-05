export const CREDIT_PACKS = [
  { id: "credits_10", name: "Starter Pack", credits: 25, price: 5, stripePriceEnv: "STRIPE_PRICE_ID_CREDITS_10" },
  { id: "credits_50", name: "Practice Pack", credits: 75, price: 12, stripePriceEnv: "STRIPE_PRICE_ID_CREDITS_50" },
  { id: "credits_200", name: "Fluent Pack", credits: 200, price: 28, stripePriceEnv: "STRIPE_PRICE_ID_CREDITS_200" }
] as const;

export const PLANS = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    monthlyCredits: Number(process.env.FREE_MONTHLY_CREDITS ?? 5),
    features: ["Free practice credits", "Voice & text conversations", "Basic progress tracking"]
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 9,
    monthlyCredits: Number(process.env.PRO_MONTHLY_CREDITS ?? 100),
    stripePriceEnv: "STRIPE_PRICE_ID_PRO_MONTHLY",
    features: ["100 monthly practice credits", "Natural, human-like voice", "Translate & replay any message", "End-of-session analysis"]
  }
] as const;

export function getCreditPack(id: string) {
  return CREDIT_PACKS.find((pack) => pack.id === id);
}
