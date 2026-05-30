import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureUserProfile } from "@/lib/db/queries";
import { users } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL("/login", request.url), 303);

  const profile = await ensureUserProfile(user);
  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  let customerId = profile.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({ email: profile.email, metadata: { userId: profile.id } });
    customerId = customer.id;
    await getDb().update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, profile.id));
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/dashboard`
  });

  return NextResponse.redirect(portal.url, 303);
}
