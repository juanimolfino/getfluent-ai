import nextEnv from "@next/env";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import Stripe from "stripe";
import OpenAI from "openai";
import { Resend } from "resend";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PRICE_ID_STARTER_MONTHLY",
  "STRIPE_PRICE_ID_PLUS_MONTHLY",
  "STRIPE_PRICE_ID_PRO_MONTHLY",
  "STRIPE_PRICE_ID_PACK_MINI",
  "STRIPE_PRICE_ID_PACK_MEDIO",
  "STRIPE_PRICE_ID_PACK_BIG",
  "FAL_KEY",
  "OPENAI_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL"
];

function ok(label) {
  console.log(`OK   ${label}`);
}

function warn(label) {
  console.log(`WARN ${label}`);
}

function fail(label, error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(`FAIL ${label}: ${message}`);
  process.exitCode = 1;
}

function cleanEnv(key) {
  return process.env[key]?.trim().replace(/^["']|["']$/g, "");
}

async function check(label, fn) {
  try {
    await fn();
    ok(label);
  } catch (error) {
    fail(label, error);
  }
}

const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  fail("env vars", new Error(`missing ${missing.join(", ")}`));
} else {
  ok("env vars present");
}

await check("DATABASE_URL can query Postgres", async () => {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  await sql`select 1`;
  await sql.end();
});

await check("Supabase service role can list storage buckets", async () => {
  const supabase = createClient(
    cleanEnv("NEXT_PUBLIC_SUPABASE_URL"),
    cleanEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  const bucketName = cleanEnv("SUPABASE_STORAGE_BUCKET") ?? "ai-results";
  const bucket = data.find((bucket) => bucket.name === bucketName);
  if (!bucket) {
    warn(`Supabase bucket "${bucketName}" not found`);
  } else if (bucket.public) {
    warn(`Supabase bucket "${bucketName}" is public; private buckets are recommended`);
  }
});

await check("Supabase anon key can initialize auth client", async () => {
  const supabase = createClient(
    cleanEnv("NEXT_PUBLIC_SUPABASE_URL"),
    cleanEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
  const { error } = await supabase.auth.getSession();
  if (error) throw error;
});

await check("Upstash Redis REST ping", async () => {
  const redis = new Redis({
    url: cleanEnv("UPSTASH_REDIS_REST_URL"),
    token: cleanEnv("UPSTASH_REDIS_REST_TOKEN")
  });
  const result = await redis.ping();
  if (result !== "PONG") throw new Error(`unexpected ping result ${result}`);
});

await check("Stripe secret key can retrieve balance", async () => {
  const stripe = new Stripe(cleanEnv("STRIPE_SECRET_KEY"), {
    apiVersion: "2025-08-27.basil"
  });
  await stripe.balance.retrieve();
});

await check("Stripe configured price IDs exist", async () => {
  const stripe = new Stripe(cleanEnv("STRIPE_SECRET_KEY"), {
    apiVersion: "2025-08-27.basil"
  });
  await Promise.all([
    stripe.prices.retrieve(cleanEnv("STRIPE_PRICE_ID_STARTER_MONTHLY")),
    stripe.prices.retrieve(cleanEnv("STRIPE_PRICE_ID_PLUS_MONTHLY")),
    stripe.prices.retrieve(cleanEnv("STRIPE_PRICE_ID_PRO_MONTHLY")),
    stripe.prices.retrieve(cleanEnv("STRIPE_PRICE_ID_PACK_MINI")),
    stripe.prices.retrieve(cleanEnv("STRIPE_PRICE_ID_PACK_MEDIO")),
    stripe.prices.retrieve(cleanEnv("STRIPE_PRICE_ID_PACK_BIG"))
  ]);
});

await check("OpenAI API key can retrieve TTS model", async () => {
  const openai = new OpenAI({ apiKey: cleanEnv("OPENAI_API_KEY") });
  await openai.models.retrieve("gpt-4o-mini-tts");
});

await check("Resend API key can list domains", async () => {
  const resend = new Resend(cleanEnv("RESEND_API_KEY"));
  await resend.domains.list();
});

if (process.env.FAL_KEY) {
  ok("FAL_KEY present");
}

ok("Non-destructive checks finished");
