"use client";

import { useState, type ReactNode } from "react";

type BillingPortalButtonProps = {
  children: ReactNode;
  className: string;
};

export async function getBillingPortalUrl(fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl("/api/stripe/portal", {
    method: "POST",
    headers: { Accept: "application/json" }
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.url) {
    throw new Error(data?.error ?? "We couldn't open billing. Please try again or contact support.");
  }

  return data.url as string;
}

export async function openBillingPortal(fetchImpl: typeof fetch = fetch, redirect: (url: string) => void = (url) => {
  window.location.href = url;
}) {
  redirect(await getBillingPortalUrl(fetchImpl));
}

export function BillingPortalButton({ children, className }: BillingPortalButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleOpenBillingPortal() {
    setError(null);
    setPending(true);

    try {
      await openBillingPortal();
    } catch (error) {
      setError(error instanceof Error ? error.message : "We couldn't open billing. Please try again or contact support.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="billing-portal-control">
      <button type="button" className={className} onClick={handleOpenBillingPortal} disabled={pending}>
        {pending ? "Opening..." : children}
      </button>
      {error ? <span className="billing-portal-error" role="alert">{error}</span> : null}
    </span>
  );
}
