import { describe, expect, it, vi } from "vitest";
import { getBillingPortalUrl, openBillingPortal } from "@/components/billing/billing-portal-button";

describe("getBillingPortalUrl", () => {
  it("returns the Stripe Billing Portal URL from the API response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/p/session/live_123" })
    });

    await expect(getBillingPortalUrl(fetchImpl as unknown as typeof fetch)).resolves.toBe(
      "https://billing.stripe.com/p/session/live_123"
    );
    expect(fetchImpl).toHaveBeenCalledWith("/api/stripe/portal", {
      method: "POST",
      headers: { Accept: "application/json" }
    });
  });

  it("throws a human error when the portal API fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: "We couldn't open billing. Please try again or contact support." })
    });

    await expect(getBillingPortalUrl(fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      "We couldn't open billing. Please try again or contact support."
    );
  });

  it("redirects when the portal API returns a URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/p/session/live_123" })
    });
    const redirect = vi.fn();

    await openBillingPortal(fetchImpl as unknown as typeof fetch, redirect);

    expect(redirect).toHaveBeenCalledWith("https://billing.stripe.com/p/session/live_123");
  });
});
