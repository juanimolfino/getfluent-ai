import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";

export type StripeCreditProductType = "subscription" | "pack";

export type StripePriceCreditMetadata = {
  priceId: string;
  productId: string | null;
  productName: string | null;
  credits: number;
  type: StripeCreditProductType;
  unitAmount: number | null;
  currency: string;
  recurringInterval: string | null;
};

export type PricingProductConfig = {
  id: string;
  name: string;
  stripePriceEnv: string;
  description: string;
  features?: readonly string[];
  recommended?: boolean;
};

export const SUBSCRIPTION_PRODUCTS = [
  {
    id: "starter",
    name: "Fluent Starter",
    stripePriceEnv: "STRIPE_PRICE_ID_STARTER_MONTHLY",
    description: "A steady monthly rhythm for casual practice.",
    features: ["Full voice practice", "Conversation analysis", "Personalized exercises"]
  },
  {
    id: "plus",
    name: "Fluent Plus",
    stripePriceEnv: "STRIPE_PRICE_ID_PLUS_MONTHLY",
    description: "More conversations for learners building a habit.",
    features: ["Full voice practice", "Conversation analysis", "Personalized exercises", "More monthly credits"],
    recommended: true
  },
  {
    id: "pro",
    name: "Fluent Pro",
    stripePriceEnv: "STRIPE_PRICE_ID_PRO_MONTHLY",
    description: "The highest monthly credit allowance for intensive practice.",
    features: ["Full voice practice", "Conversation analysis", "Personalized exercises", "Best subscription allowance"]
  }
] as const satisfies readonly PricingProductConfig[];

export const CREDIT_PACKS = [
  {
    id: "pack_mini",
    name: "Pack Mini",
    stripePriceEnv: "STRIPE_PRICE_ID_PACK_MINI",
    description: "A small pack for a focused burst of practice."
  },
  {
    id: "pack_medio",
    name: "Pack Medio",
    stripePriceEnv: "STRIPE_PRICE_ID_PACK_MEDIO",
    description: "A flexible pack for occasional practice."
  },
  {
    id: "pack_grande",
    name: "Pack Grande",
    stripePriceEnv: "STRIPE_PRICE_ID_PACK_BIG",
    description: "The best pack value when you do not want a subscription."
  }
] as const satisfies readonly PricingProductConfig[];

export const PLANS = [
  {
    id: "free",
    name: "Free",
    description: "Try GetFluent with free credits.",
    features: ["5 free credits once", "Full voice practice", "Conversation analysis"]
  },
  ...SUBSCRIPTION_PRODUCTS
] as const;

function parsePositiveIntegerMetadata(value: string | undefined, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Stripe Price metadata.${field} must be a positive integer`);
  }
  return parsed;
}

export function parseStripeCreditMetadata(price: Pick<Stripe.Price, "id" | "metadata" | "unit_amount" | "currency" | "recurring" | "product">): StripePriceCreditMetadata {
  const type = price.metadata.type;
  if (type !== "subscription" && type !== "pack") {
    throw new Error("Stripe Price metadata.type must be subscription or pack");
  }

  const product = typeof price.product === "string" ? null : price.product;
  const productName = product && "name" in product && typeof product.name === "string" ? product.name : null;

  return {
    priceId: price.id,
    productId: typeof price.product === "string" ? price.product : product?.id ?? null,
    productName,
    credits: parsePositiveIntegerMetadata(price.metadata.credits, "credits"),
    type,
    unitAmount: price.unit_amount,
    currency: price.currency,
    recurringInterval: price.recurring?.interval ?? null
  };
}

export function getPriceIdFromEnv(envName: string) {
  const priceId = process.env[envName]?.trim();
  if (!priceId) throw new Error(`${envName} is required`);
  return priceId;
}

export async function getStripePriceCreditMetadata(priceId: string) {
  return getStripe()
    .prices
    .retrieve(priceId, { expand: ["product"] })
    .then(parseStripeCreditMetadata);
}

export async function getConfiguredStripePriceMetadata(product: PricingProductConfig) {
  return getStripePriceCreditMetadata(getPriceIdFromEnv(product.stripePriceEnv));
}

export function getCreditPack(id: string) {
  return CREDIT_PACKS.find((pack) => pack.id === id);
}

export function getSubscriptionProduct(id: string) {
  return SUBSCRIPTION_PRODUCTS.find((product) => product.id === id);
}

export function formatStripeUnitAmount(unitAmount: number | null, currency: string) {
  if (unitAmount === null) return "";
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: unitAmount % 100 === 0 ? 0 : 2
  }).format(unitAmount / 100);
}
