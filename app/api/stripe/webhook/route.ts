import { NextResponse, after } from "next/server";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { addPackCredits, getUserCreditBalance, resetSubscriptionCredits } from "@/lib/db/queries";
import { subscriptions, users } from "@/lib/db/schema";
import { sendTelegram } from "@/lib/notify/telegram";
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

type InvoiceWithSubscriptionContext = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  parent?: {
    subscription_details?: {
      subscription?: string | null;
      metadata?: Stripe.Metadata | null;
    } | null;
  } | null;
  lines?: {
    data?: Array<{
      metadata?: Stripe.Metadata | null;
      parent?: {
        subscription_item_details?: {
          subscription?: string | null;
        } | null;
      } | null;
    }>;
  };
};

function getInvoiceSubscriptionContext(invoice: InvoiceWithSubscriptionContext) {
  const legacySubscription = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id;
  const parentDetails = invoice.parent?.subscription_details;
  const line = invoice.lines?.data?.[0];

  return {
    subscriptionId:
      legacySubscription ??
      parentDetails?.subscription ??
      line?.parent?.subscription_item_details?.subscription ??
      null,
    metadata: parentDetails?.metadata ?? line?.metadata ?? {}
  };
}

function getSubscriptionPeriod(subscription: Stripe.Subscription & {
  current_period_start?: number;
  current_period_end?: number;
}) {
  const item = subscription.items.data[0] as Stripe.SubscriptionItem & {
    current_period_start?: number;
    current_period_end?: number;
  };

  return {
    periodStart: subscription.current_period_start ?? item?.current_period_start ?? null,
    periodEnd: subscription.current_period_end ?? item?.current_period_end ?? null
  };
}

function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

async function findUserIdByStripeCustomerId(customerId: string | null) {
  if (!customerId) return null;
  const user = await getDb().query.users.findFirst({ where: eq(users.stripeCustomerId, customerId) });
  return user?.id ?? null;
}

async function findUserIdByStripeSubscriptionId(subscriptionId: string | null) {
  if (!subscriptionId) return null;
  const subscription = await getDb().query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, subscriptionId)
  });
  return subscription?.userId ?? null;
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
    const customerId = getCustomerId(session.customer);
    const userId = session.metadata?.userId ?? session.client_reference_id ?? await findUserIdByStripeCustomerId(customerId);
    if (userId && customerId) {
      await getDb().update(users).set({ stripeCustomerId: customerId, updatedAt: new Date() }).where(eq(users.id, userId));
    }
    if (userId && session.metadata?.kind === "pack") {
      const priceId = await getCheckoutSessionPriceId(session.id);
      if (!priceId) return NextResponse.json({ error: "Missing checkout price" }, { status: 400 });
      const priceMetadata = await getStripePriceCreditMetadata(priceId);
      if (priceMetadata.type !== "pack") return NextResponse.json({ error: "Invalid checkout price metadata" }, { status: 400 });

      const amountCents = session.amount_total ?? 0;
      const currency = (session.currency ?? "").toUpperCase();
      try {
        await addPackCredits(userId, priceMetadata.credits, {
          kind: "pack",
          checkoutSessionId: session.id,
          priceId,
          amountCents
        }, event.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await sendTelegram(`🚨 ERROR acreditando PACK\nUser: ${userId}\nEvento: ${event.id}\nError: ${message}`);
        return NextResponse.json({ error: "credit grant failed" }, { status: 500 });
      }

      after(async () => {
        const balance = await getUserCreditBalance(userId);
        await sendTelegram(
          `✅ Pago PACK\nUser: ${userId}\nMonto: ${amountCents / 100} ${currency}\nCréditos otorgados: ${priceMetadata.credits}\nSaldo actual: ${balance.total}`
        );
      });
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as InvoiceWithSubscriptionContext;
    const { subscriptionId, metadata: invoiceMetadata } = getInvoiceSubscriptionContext(invoice);
    if (subscriptionId) {
      const subscription = (await getStripe().subscriptions.retrieve(subscriptionId)) as Stripe.Subscription & {
        current_period_start?: number;
        current_period_end?: number;
      };
      const customerId = getCustomerId(subscription.customer);
      const userId =
        subscription.metadata.userId ??
        invoiceMetadata.userId ??
        await findUserIdByStripeSubscriptionId(subscriptionId) ??
        await findUserIdByStripeCustomerId(customerId);
      if (userId) {
        const priceId = subscription.metadata.priceId || invoiceMetadata.priceId || subscription.items.data[0]?.price.id;
        if (!priceId) return NextResponse.json({ error: "Missing subscription price" }, { status: 400 });
        const priceMetadata = await getStripePriceCreditMetadata(priceId);
        if (priceMetadata.type !== "subscription") return NextResponse.json({ error: "Invalid subscription price metadata" }, { status: 400 });

        const period = getSubscriptionPeriod(subscription);
        const periodStart = period.periodStart
          ? new Date(period.periodStart * 1000)
          : null;
        const periodEnd = period.periodEnd
          ? new Date(period.periodEnd * 1000)
          : null;
        const currency = (invoice.currency ?? "").toUpperCase();
        try {
          await resetSubscriptionCredits(userId, priceMetadata.credits, {
            kind: "subscription",
            subscriptionId,
            priceId,
            amountCents: invoice.amount_paid
          }, event.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await sendTelegram(`🚨 ERROR acreditando SUB\nUser: ${userId}\nEvento: ${event.id}\nError: ${message}`);
          return NextResponse.json({ error: "credit grant failed" }, { status: 500 });
        }

        after(async () => {
          const balance = await getUserCreditBalance(userId);
          await sendTelegram(
            `✅ Pago SUB\nUser: ${userId}\nMonto: ${invoice.amount_paid / 100} ${currency}\nCréditos otorgados: ${priceMetadata.credits}\nSaldo actual: ${balance.total}`
          );
        });
        await getDb().insert(subscriptions).values({
          userId,
          plan: subscription.metadata.plan ?? invoiceMetadata.plan ?? "pro",
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
