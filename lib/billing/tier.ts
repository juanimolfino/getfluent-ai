import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";

const PREMIUM_PLANS = ["pro"];
const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"];

export async function isPremiumUser(userId: string): Promise<boolean> {
  const now = new Date();
  const subscription = await getDb().query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      inArray(subscriptions.plan, PREMIUM_PLANS),
      inArray(subscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES),
      or(isNull(subscriptions.currentPeriodEnd), gt(subscriptions.currentPeriodEnd, now))
    ),
    orderBy: desc(subscriptions.createdAt)
  });

  return Boolean(subscription);
}
