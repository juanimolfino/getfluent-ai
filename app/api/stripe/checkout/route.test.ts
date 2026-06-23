import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { ensureUserProfile } from "@/lib/db/queries";
import { getConfiguredStripePriceMetadata } from "@/lib/stripe/pricing";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/stripe/checkout/route";

vi.mock("@/lib/db/queries", () => ({
  ensureUserProfile: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn()
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: vi.fn()
}));

vi.mock("@/lib/stripe/pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe/pricing")>();
  return {
    ...actual,
    getConfiguredStripePriceMetadata: vi.fn(),
    getPriceIdFromEnv: vi.fn((envName: string) => `price_${envName.toLowerCase()}`)
  };
});

const mockEnsureUserProfile = vi.mocked(ensureUserProfile);
const mockGetDb = vi.mocked(getDb);
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockGetStripe = vi.mocked(getStripe);
const mockGetConfiguredStripePriceMetadata = vi.mocked(getConfiguredStripePriceMetadata);

function checkoutRequest(form: Record<string, string>, origin = "http://localhost:3000") {
  const body = new FormData();
  Object.entries(form).forEach(([key, value]) => body.set(key, value));

  return new Request("http://localhost:3000/api/stripe/checkout", {
    method: "POST",
    headers: { Origin: origin },
    body
  });
}

describe("POST /api/stripe/checkout", () => {
  const createCheckoutSession = vi.fn();
  const createCustomer = vi.fn();
  const updateUserWhere = vi.fn().mockResolvedValue(undefined);
  const updateUserSet = vi.fn(() => ({ where: updateUserWhere }));
  const updateUser = vi.fn(() => ({ set: updateUserSet }));

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user-1", email: "user@example.com" } } })
      }
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    mockEnsureUserProfile.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      stripeCustomerId: null
    } as Awaited<ReturnType<typeof ensureUserProfile>>);
    mockGetDb.mockReturnValue({ update: updateUser } as unknown as ReturnType<typeof getDb>);
    mockGetStripe.mockReturnValue({
      customers: {
        create: createCustomer
      },
      checkout: {
        sessions: {
          create: createCheckoutSession
        }
      }
    } as unknown as ReturnType<typeof getStripe>);
    createCustomer.mockResolvedValue({ id: "cus_new" });
    createCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
  });

  it("rejects cross-origin checkout requests before auth", async () => {
    const response = await POST(checkoutRequest({ mode: "credits", packId: "pack_mini" }, "https://evil.example"));

    expect(response.status).toBe(403);
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("creates subscription checkout from the selected plan and Stripe metadata", async () => {
    mockGetConfiguredStripePriceMetadata.mockResolvedValue({
      priceId: "price_starter",
      productId: "prod_starter",
      productName: "Fluent Starter",
      credits: 15,
      type: "subscription",
      unitAmount: 890,
      currency: "usd",
      recurringInterval: "month"
    });

    const response = await POST(checkoutRequest({ mode: "subscription", planId: "starter" }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.test/session");
    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      customer: "cus_new",
      client_reference_id: "user-1",
      line_items: [{ price: "price_stripe_price_id_starter_monthly", quantity: 1 }],
      metadata: expect.objectContaining({ userId: "user-1", kind: "subscription", plan: "starter" }),
      subscription_data: { metadata: expect.objectContaining({ userId: "user-1", plan: "starter" }) }
    }));
    expect(createCustomer).toHaveBeenCalledWith({
      email: "user@example.com",
      metadata: { userId: "user-1" }
    });
    expect(updateUser).toHaveBeenCalled();
  });

  it("reuses an existing Stripe customer for checkout", async () => {
    mockEnsureUserProfile.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      stripeCustomerId: "cus_existing"
    } as Awaited<ReturnType<typeof ensureUserProfile>>);
    mockGetConfiguredStripePriceMetadata.mockResolvedValue({
      priceId: "price_starter",
      productId: "prod_starter",
      productName: "Fluent Starter",
      credits: 15,
      type: "subscription",
      unitAmount: 890,
      currency: "usd",
      recurringInterval: "month"
    });

    const response = await POST(checkoutRequest({ mode: "subscription", planId: "starter" }));

    expect(response.status).toBe(303);
    expect(createCustomer).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      customer: "cus_existing"
    }));
  });

  it("creates one-time pack checkout from the selected pack and Stripe metadata", async () => {
    mockGetConfiguredStripePriceMetadata.mockResolvedValue({
      priceId: "price_pack_mini",
      productId: "prod_pack_mini",
      productName: "Pack Mini",
      credits: 5,
      type: "pack",
      unitAmount: 490,
      currency: "usd",
      recurringInterval: null
    });

    const response = await POST(checkoutRequest({ mode: "credits", packId: "pack_mini" }));

    expect(response.status).toBe(303);
    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment",
      customer: "cus_new",
      client_reference_id: "user-1",
      line_items: [{ price: "price_stripe_price_id_pack_mini", quantity: 1 }],
      metadata: expect.objectContaining({ userId: "user-1", kind: "pack", packId: "pack_mini" })
    }));
  });
});
