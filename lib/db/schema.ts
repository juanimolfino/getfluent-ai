import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

export const jobStatusEnum = pgEnum("job_status", ["pending", "processing", "done", "failed"]);
export const jobTypeEnum = pgEnum("job_type", ["image", "tts"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "credit_purchase",
  "subscription_payment",
  "credit_spend",
  "credit_refund",
  "signup_bonus"
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  authUserId: uuid("auth_user_id").notNull().unique(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const credits = pgTable("credits", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  balance: integer("balance").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  plan: text("plan").default("free").notNull(),
  status: text("status").default("inactive").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index("subscriptions_premium_lookup_idx").on(
    table.userId,
    table.plan,
    table.status,
    table.currentPeriodEnd,
    table.createdAt
  )
]);

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: jobTypeEnum("type").notNull(),
  status: jobStatusEnum("status").default("pending").notNull(),
  input: jsonb("input").$type<Record<string, unknown>>().notNull(),
  resultUrl: text("result_url"),
  error: text("error"),
  creditsUsed: integer("credits_used").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: transactionTypeEnum("type").notNull(),
  credits: integer("credits").notNull(),
  amountCents: integer("amount_cents"),
  stripeEventId: text("stripe_event_id").unique(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const userRelations = relations(users, ({ one, many }) => ({
  credits: one(credits),
  jobs: many(jobs),
  subscriptions: many(subscriptions),
  transactions: many(transactions)
}));

export type User = typeof users.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobType = typeof jobTypeEnum.enumValues[number];
export type JobStatus = typeof jobStatusEnum.enumValues[number];

export const englishLevelEnum = pgEnum("english_level", ["A1", "A2", "B1", "B2", "C1", "C2"]);
export const nativeLanguageEnum = pgEnum("native_language", [
  "spanish",
  "portuguese",
  "french",
  "italian",
  "german",
  "other"
]);
export const sessionStatusEnum = pgEnum("session_status", ["setup", "active", "completed", "analyzed"]);

export const userLanguageProfiles = pgTable("user_language_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  // References users.id.
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  nativeLanguage: nativeLanguageEnum("native_language").default("spanish").notNull(),
  englishLevel: englishLevelEnum("english_level").default("A1").notNull(),
  interests: jsonb("interests").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  preferredTopics: jsonb("preferred_topics").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export type ConversationTurn = {
  role: "assistant" | "user";
  content: string;
  audioUrl?: string;
  timestamp: string;
};

export const conversationSessions = pgTable("conversation_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: sessionStatusEnum("status").default("setup").notNull(),
  englishLevel: englishLevelEnum("english_level").notNull(),
  topic: text("topic").notNull(),
  targetTurns: integer("target_turns").default(10).notNull(),
  completedTurns: integer("completed_turns").default(0).notNull(),
  turns: jsonb("turns").$type<ConversationTurn[]>().default(sql`'[]'::jsonb`).notNull(),
  transcript: text("transcript"),
  creditsUsed: integer("credits_used").default(0).notNull(),
  charactersUsed: integer("characters_used").default(0).notNull(),
  sttAudioMsUsed: integer("stt_audio_ms_used").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export type UserLanguageProfile = typeof userLanguageProfiles.$inferSelect;
export type ConversationSession = typeof conversationSessions.$inferSelect;
export type EnglishLevel = typeof englishLevelEnum.enumValues[number];
export type NativeLanguage = typeof nativeLanguageEnum.enumValues[number];
export type SessionStatus = typeof sessionStatusEnum.enumValues[number];
