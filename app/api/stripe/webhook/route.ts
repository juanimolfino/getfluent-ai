import { NextResponse } from "next/server";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { addCredits } from "@/lib/db/queries";
import { subscriptions, users } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe/client";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    if (userId && session.customer) {
      await getDb().update(users).set({ stripeCustomerId: String(session.customer) }).where(eq(users.id, userId));
    }
    if (userId && session.metadata?.kind === "credits") {
      await addCredits(userId, Number(session.metadata.credits ?? 0), {
        kind: "credits",
        checkoutSessionId: session.id,
        amountCents: session.amount_total ?? 0
      }, event.id);
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null;
    };
    const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
    if (subscriptionId) {
      const subscription = (await getStripe().subscriptions.retrieve(subscriptionId)) as Stripe.Subscription & {
        current_period_start?: number;
        current_period_end?: number;
      };
      const userId = subscription.metadata.userId;
      if (userId) {
        const credits = Number(process.env.PRO_MONTHLY_CREDITS ?? 100);
        const periodStart = subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000)
          : null;
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null;
        await addCredits(userId, credits, {
          kind: "subscription",
          subscriptionId,
          amountCents: invoice.amount_paid
        }, event.id);
        await getDb().insert(subscriptions).values({
          userId,
          plan: subscription.metadata.plan ?? "pro",
          status: subscription.status,
          stripeSubscriptionId: subscription.id,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        }).onConflictDoUpdate({
          target: subscriptions.stripeSubscriptionId,
          set: {
            status: subscription.status,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            updatedAt: new Date()
          }
        });
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await getDb()
      .update(subscriptions)
      .set({ status: "canceled", cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  }

  return NextResponse.json({ received: true });
}
