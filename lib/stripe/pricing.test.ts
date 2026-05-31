import { describe, expect, it } from "vitest";
import { CREDIT_PACKS, getCreditPack, PLANS } from "@/lib/stripe/pricing";

describe("pricing config", () => {
  it("keeps Fluent prices wired to Stripe price env vars", () => {
    expect(CREDIT_PACKS).toEqual([
      { id: "credits_10", name: "Starter Pack", credits: 25, price: 5, stripePriceEnv: "STRIPE_PRICE_ID_CREDITS_10" },
      { id: "credits_50", name: "Practice Pack", credits: 75, price: 12, stripePriceEnv: "STRIPE_PRICE_ID_CREDITS_50" }
    ]);

    expect(PLANS.find((plan) => plan.id === "pro")).toMatchObject({
      priceMonthly: 9,
      stripePriceEnv: "STRIPE_PRICE_ID_PRO_MONTHLY"
    });
  });

  it("finds credit packs by public id", () => {
    expect(getCreditPack("credits_10")?.credits).toBe(25);
    expect(getCreditPack("missing")).toBeUndefined();
  });
});
