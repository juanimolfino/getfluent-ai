import { desc, eq } from "drizzle-orm";
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
