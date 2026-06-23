import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/db/queries";
import { getStripe } from "@/lib/stripe/client";
import { rejectForbiddenOrigin } from "@/lib/http/forbidden-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getBillingPortalErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/configuration|customer portal/i.test(message)) {
    return "Stripe Billing Portal is not configured. Configure it in Stripe Dashboard > Billing > Customer portal.";
  }
  return "We couldn't open billing. Please try again or contact support.";
}

export async function POST(request: Request) {
  const originResponse = rejectForbiddenOrigin(request, "stripe_portal");
  if (originResponse) return originResponse;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "You must be logged in to manage billing." }, { status: 401 });

  const profile = await ensureUserProfile(user);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  if (!profile.stripeCustomerId) {
    return NextResponse.json({
      error: "No Stripe customer is linked to this account yet. Please buy a plan or contact support."
    }, { status: 400 });
  }

  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${appUrl}/dashboard`
    });

    return NextResponse.json({ url: portal.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create Stripe billing portal session";
    console.error("Stripe billing portal session failed", { userId: profile.id, message });
    return NextResponse.json({ error: getBillingPortalErrorMessage(error) }, { status: 502 });
  }
}
