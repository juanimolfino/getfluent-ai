import { NextResponse } from "next/server";
import {
  checkExpensiveEndpointRateLimit,
  checkMonthlyUsageLimit,
  isRateLimitConfigurationError,
  type ExpensiveEndpointRateLimitKind,
  type MonthlyUsageLimitKind
} from "@/lib/redis/rate-limit";

export async function enforceExpensiveEndpointRateLimit(input: {
  userId: string;
  kind: ExpensiveEndpointRateLimitKind;
}) {
  try {
    const rateLimit = await checkExpensiveEndpointRateLimit(input);
    if (!rateLimit.limited) return null;

    console.warn(
      `[rate-limit] limited kind=${input.kind} userId=${input.userId} count=${rateLimit.count ?? "unknown"} max=${rateLimit.max ?? "unknown"} window=${rateLimit.windowSeconds ?? "unknown"}s`
    );
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  } catch (error) {
    if (isRateLimitConfigurationError(error)) {
      return NextResponse.json({ error: "Rate limiting is not configured" }, { status: 503 });
    }
    throw error;
  }
}

export async function enforceMonthlyUsageLimit(input: {
  userId: string;
  kind: MonthlyUsageLimitKind;
}) {
  try {
    const usageLimit = await checkMonthlyUsageLimit(input);
    if (!usageLimit.limited) return null;

    console.warn(
      `[usage-limit] monthly limited kind=${input.kind} userId=${input.userId} count=${usageLimit.count ?? "unknown"} max=${usageLimit.max ?? "unknown"}`
    );
    return NextResponse.json({ error: "Monthly usage limit reached" }, { status: 429 });
  } catch (error) {
    if (isRateLimitConfigurationError(error)) {
      return NextResponse.json({ error: "Rate limiting is not configured" }, { status: 503 });
    }
    throw error;
  }
}
