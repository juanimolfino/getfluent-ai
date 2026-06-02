import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  appendTurnToSession,
  completeConversationSession,
  createConversationSession,
  getConversationSessionById,
  getConversationSession,
  getUserRecentSessions
} from "@/lib/db/fluent-queries";
import { conversationSessions, type ConversationSession, type ConversationTurn, type EnglishLevel } from "@/lib/db/schema";

// Single source of truth for session-state access. To move hot-path reads/writes to Redis later, change only the implementations here — callers stay unchanged.
export async function getSessionState(sessionId: string, userId: string): Promise<ConversationSession | null> {
  return getConversationSession(sessionId, userId);
}

export async function getSessionStateById(sessionId: string): Promise<ConversationSession | null> {
  return getConversationSessionById(sessionId);
}

export async function createSessionState(data: {
  userId: string;
  englishLevel: EnglishLevel;
  topic: string;
  targetTurns: number;
}): Promise<ConversationSession> {
  return createConversationSession(data);
}

export async function getRecentSessionStates(userId: string, limit = 10): Promise<ConversationSession[]> {
  return getUserRecentSessions(userId, limit);
}

export async function saveUserTurn(sessionId: string, turn: ConversationTurn): Promise<ConversationSession> {
  if (turn.role !== "user") throw new Error("saveUserTurn requires a user turn");
  return appendTurnToSession(sessionId, turn);
}

export async function saveAssistantTurn(sessionId: string, turn: ConversationTurn): Promise<ConversationSession> {
  if (turn.role !== "assistant") throw new Error("saveAssistantTurn requires an assistant turn");
  return appendTurnToSession(sessionId, turn);
}

export async function markSessionComplete(sessionId: string): Promise<ConversationSession> {
  return completeConversationSession(sessionId);
}

export async function getSessionProgress(sessionId: string): Promise<{
  completedTurns: number;
  targetTurns: number;
  status: ConversationSession["status"];
} | null> {
  const session = await getDb().query.conversationSessions.findFirst({
    where: eq(conversationSessions.id, sessionId),
    columns: {
      completedTurns: true,
      targetTurns: true,
      status: true
    }
  });

  if (!session) return null;
  return session;
}

export async function incrementCharactersUsed(sessionId: string, count: number): Promise<number> {
  if (!Number.isInteger(count) || count < 0) throw new Error("incrementCharactersUsed requires a non-negative integer");

  if (count === 0) {
    const session = await getDb().query.conversationSessions.findFirst({
      where: eq(conversationSessions.id, sessionId),
      columns: { charactersUsed: true }
    });
    if (!session) throw new Error("Conversation session not found");
    return session.charactersUsed;
  }

  const [updated] = await getDb()
    .update(conversationSessions)
    .set({
      charactersUsed: sql`${conversationSessions.charactersUsed} + ${count}`,
      updatedAt: new Date()
    })
    .where(eq(conversationSessions.id, sessionId))
    .returning({ charactersUsed: conversationSessions.charactersUsed });

  if (!updated) throw new Error("Conversation session not found");
  return updated.charactersUsed;
}
