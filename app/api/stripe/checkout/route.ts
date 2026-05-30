import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/db/queries";
import { getCreditPack } from "@/lib/stripe/pricing";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL("/login", request.url), 303);

  const profile = await ensureUserProfile(user);
  const form = await request.formData();
  const mode = String(form.get("mode") ?? "credits");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  if (mode === "subscription") {
    const price = process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
    if (!price) throw new Error("STRIPE_PRICE_ID_PRO_MONTHLY is required");
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer_email: profile.email,
      line_items: [{ price, quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/pricing`,
      metadata: { userId: profile.id, kind: "subscription", plan: "pro" },
      subscription_data: { metadata: { userId: profile.id, plan: "pro" } }
    });
    return NextResponse.redirect(session.url!, 303);
  }

  const pack = getCreditPack(String(form.get("packId") ?? "credits_10"));
  if (!pack) return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
  const price = process.env[pack.stripePriceEnv];
  if (!price) throw new Error(`${pack.stripePriceEnv} is required`);

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: profile.email,
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/pricing`,
    metadata: { userId: profile.id, kind: "credits", credits: String(pack.credits) }
  });

  return NextResponse.redirect(session.url!, 303);
}
