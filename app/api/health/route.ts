import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

const envKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "STRIPE_SECRET_KEY",
  "OPENAI_API_KEY",
  "FAL_KEY",
  "RESEND_API_KEY"
] as const;

export async function GET(request: Request) {
  const configuredSecret = process.env.HEALTHCHECK_SECRET;
  const authorization = request.headers.get("authorization");
  const suppliedSecret = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;

  if (process.env.NODE_ENV === "production" && (!configuredSecret || suppliedSecret !== configuredSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const env = Object.fromEntries(envKeys.map((key) => [key, Boolean(process.env[key])]));
  const checks: Record<string, unknown> = { env };

  try {
    const db = getDb();
    const result = await db.execute(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('users', 'credits', 'jobs', 'subscriptions', 'transactions')
      order by table_name
    `);

    checks.database = {
      ok: true,
      tables: result.map((row) => row.table_name)
    };
  } catch (error) {
    checks.database = {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  return NextResponse.json(checks, {
    status: checks.database && typeof checks.database === "object" && "ok" in checks.database && checks.database.ok ? 200 : 500
  });
}
