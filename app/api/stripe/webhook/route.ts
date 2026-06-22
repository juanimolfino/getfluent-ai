import { NextResponse } from "next/server";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { addPackCredits, resetSubscriptionCredits } from "@/lib/db/queries";
import { subscriptions, users } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe/client";
import { getStripePriceCreditMetadata } from "@/lib/stripe/pricing";

async function getCheckoutSessionPriceId(sessionId: string) {
  const lineItems = await getStripe().checkout.sessions.listLineItems(sessionId, {
    limit: 1,
    expand: ["data.price"]
  });
  const price = lineItems.data[0]?.price;
  return typeof price === "string" ? price : price?.id ?? null;
}

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
    if (userId && session.metadata?.kind === "pack") {
      const priceId = await getCheckoutSessionPriceId(session.id);
      if (!priceId) return NextResponse.json({ error: "Missing checkout price" }, { status: 400 });
      const priceMetadata = await getStripePriceCreditMetadata(priceId);
      if (priceMetadata.type !== "pack") return NextResponse.json({ error: "Invalid checkout price metadata" }, { status: 400 });

      await addPackCredits(userId, priceMetadata.credits, {
        kind: "pack",
        checkoutSessionId: session.id,
        priceId,
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
        const priceId = subscription.metadata.priceId || subscription.items.data[0]?.price.id;
        if (!priceId) return NextResponse.json({ error: "Missing subscription price" }, { status: 400 });
        const priceMetadata = await getStripePriceCreditMetadata(priceId);
        if (priceMetadata.type !== "subscription") return NextResponse.json({ error: "Invalid subscription price metadata" }, { status: 400 });

        const periodStart = subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000)
          : null;
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null;
        await resetSubscriptionCredits(userId, priceMetadata.credits, {
          kind: "subscription",
          subscriptionId,
          priceId,
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
