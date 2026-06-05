import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  conversationSessions,
  userLanguageProfiles,
  type ConversationTurn,
  type EnglishLevel,
  type NativeLanguage
} from "@/lib/db/schema";

type LanguageProfileInput = {
  nativeLanguage: NativeLanguage;
  englishLevel: EnglishLevel;
  interests: string[];
  preferredTopics: string[];
};

export async function getUserLanguageProfile(userId: string) {
  const profile = await getDb().query.userLanguageProfiles.findFirst({
    where: eq(userLanguageProfiles.userId, userId)
  });
  return profile ?? null;
}

export async function upsertUserLanguageProfile(userId: string, data: LanguageProfileInput) {
  const existing = await getUserLanguageProfile(userId);

  if (existing) {
    const [profile] = await getDb()
      .update(userLanguageProfiles)
      .set({
        nativeLanguage: data.nativeLanguage,
        englishLevel: data.englishLevel,
        interests: data.interests,
        preferredTopics: data.preferredTopics,
        updatedAt: new Date()
      })
      .where(eq(userLanguageProfiles.userId, userId))
      .returning();
    return profile;
  }

  const [profile] = await getDb()
    .insert(userLanguageProfiles)
    .values({
      userId,
      nativeLanguage: data.nativeLanguage,
      englishLevel: data.englishLevel,
      interests: data.interests,
      preferredTopics: data.preferredTopics
    })
    .returning();
  return profile;
}

export async function createConversationSession(data: {
  userId: string;
  englishLevel: EnglishLevel;
  topic: string;
  targetTurns: number;
}) {
  const [session] = await getDb()
    .insert(conversationSessions)
    .values({
      userId: data.userId,
      status: "active",
      englishLevel: data.englishLevel,
      topic: data.topic,
      targetTurns: data.targetTurns,
      completedTurns: 0,
      turns: []
    })
    .returning();
  return session;
}

export async function getConversationSession(sessionId: string, userId: string) {
  const session = await getDb().query.conversationSessions.findFirst({
    where: eq(conversationSessions.id, sessionId)
  });

  if (!session || session.userId !== userId) return null;
  return session;
}

export async function getConversationSessionById(sessionId: string) {
  const session = await getDb().query.conversationSessions.findFirst({
    where: eq(conversationSessions.id, sessionId)
  });

  return session ?? null;
}

export async function appendTurnToSession(sessionId: string, turn: ConversationTurn) {
  const session = await getDb().query.conversationSessions.findFirst({
    where: eq(conversationSessions.id, sessionId)
  });
  if (!session) throw new Error("Conversation session not found");

  const turns = [...session.turns, turn];
  const completedTurns = turns.filter((item) => item.role === "user").length;

  const [updated] = await getDb()
    .update(conversationSessions)
    .set({ turns, completedTurns, updatedAt: new Date() })
    .where(eq(conversationSessions.id, sessionId))
    .returning();
  return updated;
}

export async function completeConversationSession(sessionId: string) {
  const session = await getDb().query.conversationSessions.findFirst({
    where: eq(conversationSessions.id, sessionId)
  });
  if (!session) throw new Error("Conversation session not found");

  const transcript = session.turns
    .map((turn) => `${turn.role === "assistant" ? "AI" : "User"}: ${turn.content}`)
    .join("\n");

  const [updated] = await getDb()
    .update(conversationSessions)
    .set({ status: "completed", transcript, updatedAt: new Date() })
    .where(eq(conversationSessions.id, sessionId))
    .returning();
  return updated;
}

export async function getUserRecentSessions(userId: string, limit = 10) {
  return getDb().query.conversationSessions.findMany({
    where: eq(conversationSessions.userId, userId),
    orderBy: desc(conversationSessions.createdAt),
    limit
  });
}

export async function getUserMonthlyCharacterUsage(userId: string) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [result] = await getDb()
    .select({
      charactersUsed: sql<number>`coalesce(sum(${conversationSessions.charactersUsed}), 0)::int`
    })
    .from(conversationSessions)
    .where(
      and(
        eq(conversationSessions.userId, userId),
        gte(conversationSessions.createdAt, monthStart),
        lt(conversationSessions.createdAt, nextMonthStart)
      )
    );

  return result?.charactersUsed ?? 0;
}

export async function getUserMonthlySttAudioMsUsage(userId: string) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [result] = await getDb()
    .select({
      sttAudioMsUsed: sql<number>`coalesce(sum(${conversationSessions.sttAudioMsUsed}), 0)::int`
    })
    .from(conversationSessions)
    .where(
      and(
        eq(conversationSessions.userId, userId),
        gte(conversationSessions.createdAt, monthStart),
        lt(conversationSessions.createdAt, nextMonthStart)
      )
    );

  return result?.sttAudioMsUsed ?? 0;
}
