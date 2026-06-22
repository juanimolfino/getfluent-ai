import { describe, expect, it } from "vitest";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PRODUCTS,
  getCreditPack,
  getSubscriptionProduct,
  parseStripeCreditMetadata
} from "@/lib/stripe/pricing";

describe("pricing config", () => {
  it("keeps Fluent products wired to Stripe price env vars without hardcoded credit amounts", () => {
    expect(SUBSCRIPTION_PRODUCTS.map((product) => [product.id, product.stripePriceEnv])).toEqual([
      ["starter", "STRIPE_PRICE_ID_STARTER_MONTHLY"],
      ["plus", "STRIPE_PRICE_ID_PLUS_MONTHLY"],
      ["pro", "STRIPE_PRICE_ID_PRO_MONTHLY"]
    ]);
    expect(CREDIT_PACKS.map((pack) => [pack.id, pack.stripePriceEnv])).toEqual([
      ["pack_mini", "STRIPE_PRICE_ID_PACK_MINI"],
      ["pack_medio", "STRIPE_PRICE_ID_PACK_MEDIO"],
      ["pack_grande", "STRIPE_PRICE_ID_PACK_BIG"]
    ]);
    expect(SUBSCRIPTION_PRODUCTS.some((product) => "credits" in product)).toBe(false);
    expect(CREDIT_PACKS.some((pack) => "price" in pack)).toBe(false);
  });

  it("finds products by public id", () => {
    expect(getSubscriptionProduct("plus")?.stripePriceEnv).toBe("STRIPE_PRICE_ID_PLUS_MONTHLY");
    expect(getCreditPack("pack_mini")?.stripePriceEnv).toBe("STRIPE_PRICE_ID_PACK_MINI");
    expect(getCreditPack("missing")).toBeUndefined();
  });

  it("parses credit metadata from Stripe prices", () => {
    expect(parseStripeCreditMetadata({
      id: "price_test",
      metadata: { credits: "15", type: "subscription" },
      unit_amount: 890,
      currency: "usd",
      recurring: { interval: "month" } as never,
      product: { id: "prod_test", name: "Fluent Starter" } as never
    })).toEqual({
      priceId: "price_test",
      productId: "prod_test",
      productName: "Fluent Starter",
      credits: 15,
      type: "subscription",
      unitAmount: 890,
      currency: "usd",
      recurringInterval: "month"
    });
  });

  it("rejects missing or invalid Stripe credit metadata", () => {
    expect(() => parseStripeCreditMetadata({
      id: "price_test",
      metadata: { credits: "0", type: "pack" },
      unit_amount: 490,
      currency: "usd",
      recurring: null,
      product: "prod_test"
    })).toThrow("metadata.credits");

    expect(() => parseStripeCreditMetadata({
      id: "price_test",
      metadata: { credits: "5", type: "wrong" },
      unit_amount: 490,
      currency: "usd",
      recurring: null,
      product: "prod_test"
    })).toThrow("metadata.type");
  });
});
