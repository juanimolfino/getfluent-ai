import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { addPackCredits, getUserCreditBalance, resetSubscriptionCredits } from "@/lib/db/queries";
import { sendTelegram } from "@/lib/notify/telegram";
import { getStripe } from "@/lib/stripe/client";
import { getStripePriceCreditMetadata } from "@/lib/stripe/pricing";
import { POST } from "@/app/api/stripe/webhook/route";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((callback: () => void | Promise<void>) => {
      void callback();
    })
  };
});

vi.mock("@/lib/db", () => ({
  getDb: vi.fn()
}));

vi.mock("@/lib/db/queries", () => ({
  addPackCredits: vi.fn(),
  getUserCreditBalance: vi.fn(),
  resetSubscriptionCredits: vi.fn()
}));

vi.mock("@/lib/notify/telegram", () => ({
  sendTelegram: vi.fn()
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: vi.fn()
}));

vi.mock("@/lib/stripe/pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe/pricing")>();
  return {
    ...actual,
    getStripePriceCreditMetadata: vi.fn()
  };
});

const mockGetDb = vi.mocked(getDb);
const mockAddPackCredits = vi.mocked(addPackCredits);
const mockGetUserCreditBalance = vi.mocked(getUserCreditBalance);
const mockResetSubscriptionCredits = vi.mocked(resetSubscriptionCredits);
const mockSendTelegram = vi.mocked(sendTelegram);
const mockGetStripe = vi.mocked(getStripe);
const mockGetStripePriceCreditMetadata = vi.mocked(getStripePriceCreditMetadata);

function webhookRequest() {
  return new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "valid-signature" },
    body: "{}"
  });
}

function mockDb() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  const findUser = vi.fn().mockResolvedValue(null);
  const findSubscription = vi.fn().mockResolvedValue(null);
  mockGetDb.mockReturnValue({
    update,
    insert,
    query: {
      users: { findFirst: findUser },
      subscriptions: { findFirst: findSubscription }
    }
  } as unknown as ReturnType<typeof getDb>);
  return { update, insert, values, onConflictDoUpdate, findUser, findSubscription };
}

describe("POST /api/stripe/webhook", () => {
  const constructEvent = vi.fn();
  const listLineItems = vi.fn();
  const retrieveSubscription = vi.fn();
  let dbMocks: ReturnType<typeof mockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockGetUserCreditBalance.mockResolvedValue({
      creditsSubscription: 15,
      creditsPack: 0,
      total: 15
    });
    mockSendTelegram.mockResolvedValue(undefined);
    dbMocks = mockDb();
    mockGetStripe.mockReturnValue({
      webhooks: { constructEvent },
      checkout: { sessions: { listLineItems } },
      subscriptions: { retrieve: retrieveSubscription }
    } as unknown as ReturnType<typeof getStripe>);
  });

  it("adds pack credits from checkout.session.completed using Stripe Price metadata and event id", async () => {
    constructEvent.mockReturnValue({
      id: "evt_pack_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_pack_1",
          metadata: { userId: "user-1", kind: "pack" },
          customer: "cus_1",
          amount_total: 490
        }
      }
    });
    listLineItems.mockResolvedValue({
      data: [{ price: { id: "price_pack_mini" } }]
    });
    mockGetStripePriceCreditMetadata.mockResolvedValue({
      priceId: "price_pack_mini",
      productId: "prod_pack_mini",
      productName: "Pack Mini",
      credits: 5,
      type: "pack",
      unitAmount: 490,
      currency: "usd",
      recurringInterval: null
    });

    const response = await POST(webhookRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(mockAddPackCredits).toHaveBeenCalledWith("user-1", 5, {
      kind: "pack",
      checkoutSessionId: "cs_pack_1",
      priceId: "price_pack_mini",
      amountCents: 490
    }, "evt_pack_1");
    expect(mockResetSubscriptionCredits).not.toHaveBeenCalled();
  });

  it("resets subscription credits from invoice.paid using Stripe Price metadata and event id", async () => {
    constructEvent.mockReturnValue({
      id: "evt_invoice_1",
      type: "invoice.paid",
      data: {
        object: {
          subscription: "sub_1",
          amount_paid: 1490
        }
      }
    });
    retrieveSubscription.mockResolvedValue({
      id: "sub_1",
      status: "active",
      cancel_at_period_end: false,
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_592_000,
      metadata: { userId: "user-1", plan: "plus", priceId: "price_plus" },
      items: { data: [{ price: { id: "price_plus" } }] }
    });
    mockGetStripePriceCreditMetadata.mockResolvedValue({
      priceId: "price_plus",
      productId: "prod_plus",
      productName: "Fluent Plus",
      credits: 25,
      type: "subscription",
      unitAmount: 1490,
      currency: "usd",
      recurringInterval: "month"
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(mockResetSubscriptionCredits).toHaveBeenCalledWith("user-1", 25, {
      kind: "subscription",
      subscriptionId: "sub_1",
      priceId: "price_plus",
      amountCents: 1490
    }, "evt_invoice_1");
    expect(mockAddPackCredits).not.toHaveBeenCalled();
  });

  it("resets subscription credits from invoice.paid parent subscription details on newer Stripe API versions", async () => {
    constructEvent.mockReturnValue({
      id: "evt_invoice_new_shape",
      type: "invoice.paid",
      data: {
        object: {
          parent: {
            type: "subscription_details",
            subscription_details: {
              subscription: "sub_new",
              metadata: { userId: "user-1", plan: "starter", priceId: "price_starter" }
            }
          },
          lines: {
            data: [
              {
                metadata: { userId: "user-1", plan: "starter", priceId: "price_starter" },
                parent: {
                  type: "subscription_item_details",
                  subscription_item_details: { subscription: "sub_new" }
                }
              }
            ]
          },
          amount_paid: 890
        }
      }
    });
    retrieveSubscription.mockResolvedValue({
      id: "sub_new",
      status: "active",
      cancel_at_period_end: false,
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_592_000,
      metadata: {},
      items: { data: [{ price: { id: "price_starter" } }] }
    });
    mockGetStripePriceCreditMetadata.mockResolvedValue({
      priceId: "price_starter",
      productId: "prod_starter",
      productName: "Fluent Starter",
      credits: 15,
      type: "subscription",
      unitAmount: 890,
      currency: "usd",
      recurringInterval: "month"
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(mockResetSubscriptionCredits).toHaveBeenCalledWith("user-1", 15, {
      kind: "subscription",
      subscriptionId: "sub_new",
      priceId: "price_starter",
      amountCents: 890
    }, "evt_invoice_new_shape");
    expect(mockAddPackCredits).not.toHaveBeenCalled();
  });

  it("resolves invoice.paid user by Stripe customer when metadata is missing", async () => {
    constructEvent.mockReturnValue({
      id: "evt_invoice_customer_fallback",
      type: "invoice.paid",
      data: {
        object: {
          subscription: "sub_without_metadata",
          amount_paid: 890
        }
      }
    });
    dbMocks.findUser.mockResolvedValue({ id: "user-1" });
    retrieveSubscription.mockResolvedValue({
      id: "sub_without_metadata",
      customer: "cus_existing",
      status: "active",
      cancel_at_period_end: false,
      metadata: {},
      items: {
        data: [
          {
            current_period_start: 1_700_000_000,
            current_period_end: 1_702_592_000,
            price: { id: "price_starter" }
          }
        ]
      }
    });
    mockGetStripePriceCreditMetadata.mockResolvedValue({
      priceId: "price_starter",
      productId: "prod_starter",
      productName: "Fluent Starter",
      credits: 15,
      type: "subscription",
      unitAmount: 890,
      currency: "usd",
      recurringInterval: "month"
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(dbMocks.findUser).toHaveBeenCalled();
    expect(mockResetSubscriptionCredits).toHaveBeenCalledWith("user-1", 15, {
      kind: "subscription",
      subscriptionId: "sub_without_metadata",
      priceId: "price_starter",
      amountCents: 890
    }, "evt_invoice_customer_fallback");
  });

  it("rejects unsigned webhooks before granting credits", async () => {
    const response = await POST(new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: "{}"
    }));

    expect(response.status).toBe(400);
    expect(mockAddPackCredits).not.toHaveBeenCalled();
    expect(mockResetSubscriptionCredits).not.toHaveBeenCalled();
  });
});
