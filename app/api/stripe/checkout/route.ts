import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureUserProfile } from "@/lib/db/queries";
import { users } from "@/lib/db/schema";
import {
  getConfiguredStripePriceMetadata,
  getCreditPack,
  getPriceIdFromEnv,
  getSubscriptionProduct
} from "@/lib/stripe/pricing";
import { getStripe } from "@/lib/stripe/client";
import { rejectForbiddenOrigin } from "@/lib/http/forbidden-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getOrCreateStripeCustomer(profile: Awaited<ReturnType<typeof ensureUserProfile>>) {
  if (profile.stripeCustomerId) return profile.stripeCustomerId;

  const customer = await getStripe().customers.create({
    email: profile.email,
    metadata: { userId: profile.id }
  });

  await getDb().update(users).set({ stripeCustomerId: customer.id, updatedAt: new Date() }).where(eq(users.id, profile.id));
  return customer.id;
}

export async function POST(request: Request) {
  const originResponse = rejectForbiddenOrigin(request, "stripe_checkout");
  if (originResponse) return originResponse;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL("/login", request.url), 303);

  const profile = await ensureUserProfile(user);
  const form = await request.formData();
  const mode = String(form.get("mode") ?? "credits");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const customer = await getOrCreateStripeCustomer(profile);

  if (mode === "subscription") {
    const product = getSubscriptionProduct(String(form.get("planId") ?? "plus"));
    if (!product) return NextResponse.json({ error: "Invalid subscription plan" }, { status: 400 });
    const price = getPriceIdFromEnv(product.stripePriceEnv);
    const priceMetadata = await getConfiguredStripePriceMetadata(product);
    if (priceMetadata.type !== "subscription") {
      return NextResponse.json({ error: "Invalid Stripe price metadata" }, { status: 400 });
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price, quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/pricing`,
      client_reference_id: profile.id,
      metadata: { userId: profile.id, kind: "subscription", plan: product.id, priceId: price },
      subscription_data: { metadata: { userId: profile.id, plan: product.id, priceId: price } }
    });
    return NextResponse.redirect(session.url!, 303);
  }

  const pack = getCreditPack(String(form.get("packId") ?? "pack_mini"));
  if (!pack) return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
  const price = getPriceIdFromEnv(pack.stripePriceEnv);
  const priceMetadata = await getConfiguredStripePriceMetadata(pack);
  if (priceMetadata.type !== "pack") {
    return NextResponse.json({ error: "Invalid Stripe price metadata" }, { status: 400 });
  }

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/pricing`,
    client_reference_id: profile.id,
    metadata: { userId: profile.id, kind: "pack", packId: pack.id, priceId: price }
  });

  return NextResponse.redirect(session.url!, 303);
}
