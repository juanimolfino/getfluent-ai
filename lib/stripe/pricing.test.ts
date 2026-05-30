import { describe, expect, it } from "vitest";
import { CREDIT_PACKS, getCreditPack, PLANS } from "@/lib/stripe/pricing";

describe("pricing config", () => {
  it("keeps demo prices wired to Stripe price env vars", () => {
    expect(CREDIT_PACKS).toEqual([
      { id: "credits_10", credits: 10, price: 1, stripePriceEnv: "STRIPE_PRICE_ID_CREDITS_10" },
      { id: "credits_50", credits: 50, price: 2, stripePriceEnv: "STRIPE_PRICE_ID_CREDITS_50" }
    ]);

    expect(PLANS.find((plan) => plan.id === "pro")).toMatchObject({
      priceMonthly: 3,
      stripePriceEnv: "STRIPE_PRICE_ID_PRO_MONTHLY"
    });
  });

  it("finds credit packs by public id", () => {
    expect(getCreditPack("credits_10")?.credits).toBe(10);
    expect(getCreditPack("missing")).toBeUndefined();
  });
});
