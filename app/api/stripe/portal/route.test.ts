import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureUserProfile } from "@/lib/db/queries";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/stripe/portal/route";

vi.mock("@/lib/db/queries", () => ({
  ensureUserProfile: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn()
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: vi.fn()
}));

const mockEnsureUserProfile = vi.mocked(ensureUserProfile);
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockGetStripe = vi.mocked(getStripe);

function portalRequest(origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/stripe/portal", {
    method: "POST",
    headers: { Origin: origin }
  });
}

describe("POST /api/stripe/portal", () => {
  const createPortalSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://www.aigetfluent.com";
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user-1", email: "user@example.com" } } })
      }
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    mockGetStripe.mockReturnValue({
      billingPortal: {
        sessions: {
          create: createPortalSession
        }
      }
    } as unknown as ReturnType<typeof getStripe>);
    createPortalSession.mockResolvedValue({ url: "https://billing.stripe.com/p/session/live_123" });
  });

  it("returns a clear error when the user has no linked Stripe customer", async () => {
    mockEnsureUserProfile.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      stripeCustomerId: null
    } as Awaited<ReturnType<typeof ensureUserProfile>>);

    const response = await POST(portalRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("No Stripe customer is linked");
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it("creates a Billing Portal session for the linked Stripe customer", async () => {
    mockEnsureUserProfile.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      stripeCustomerId: "cus_123"
    } as Awaited<ReturnType<typeof ensureUserProfile>>);

    const response = await POST(portalRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ url: "https://billing.stripe.com/p/session/live_123" });
    expect(createPortalSession).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://www.aigetfluent.com/dashboard"
    });
  });

  it("returns a clear configuration error when Stripe Billing Portal is not configured", async () => {
    mockEnsureUserProfile.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      stripeCustomerId: "cus_123"
    } as Awaited<ReturnType<typeof ensureUserProfile>>);
    createPortalSession.mockRejectedValue(new Error("No configuration provided for the customer portal"));

    const response = await POST(portalRequest());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain("Stripe Billing Portal is not configured");
  });
});
