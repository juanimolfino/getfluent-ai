import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getAnthropic } from "@/lib/conversation/anthropic";
import { getSessionState } from "@/lib/conversation/session-state";
import { getUserLanguageProfile } from "@/lib/db/fluent-queries";
import { POST } from "@/app/api/conversation/translate/route";

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserProfile: vi.fn()
}));

vi.mock("@/lib/conversation/session-state", () => ({
  getSessionState: vi.fn(),
  hasPaidConversationCredit: vi.fn((session: { creditsUsed?: number } | null | undefined) => Boolean(session && (session.creditsUsed ?? 0) >= 1))
}));

vi.mock("@/lib/db/fluent-queries", () => ({
  getUserLanguageProfile: vi.fn()
}));

vi.mock("@/lib/conversation/anthropic", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/conversation/anthropic")>();
  return {
    ...actual,
    CONVERSATION_MODEL: "claude-sonnet-4-6",
    getAnthropic: vi.fn()
  };
});

const mockGetCurrentUserProfile = vi.mocked(getCurrentUserProfile);
const mockGetSessionState = vi.mocked(getSessionState);
const mockGetUserLanguageProfile = vi.mocked(getUserLanguageProfile);
const mockGetAnthropic = vi.mocked(getAnthropic);

function translateRequest(body: unknown) {
  return new Request("http://localhost:3000/api/conversation/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/conversation/translate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserProfile.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getCurrentUserProfile>>);
    mockGetUserLanguageProfile.mockResolvedValue({ nativeLanguage: "spanish" } as Awaited<ReturnType<typeof getUserLanguageProfile>>);
    mockGetSessionState.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      creditsUsed: 1,
      turns: [
        { role: "assistant", content: "Tell me about your day.", timestamp: "2026-01-01T00:00:00.000Z" },
        { role: "user", content: "It was good.", timestamp: "2026-01-01T00:00:01.000Z" }
      ]
    } as Awaited<ReturnType<typeof getSessionState>>);
    mockGetAnthropic.mockReturnValue({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Cuéntame sobre tu día." }]
        })
      }
    } as unknown as ReturnType<typeof getAnthropic>);
  });

  it("translates an Alex message from the user's session", async () => {
    const response = await POST(translateRequest({
      sessionId: "11111111-1111-4111-8111-111111111111",
      text: "Tell me about your day."
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      translation: "Cuéntame sobre tu día.",
      targetLanguage: "Spanish"
    });
  });

  it("rejects text that is not an Alex message in the session", async () => {
    const response = await POST(translateRequest({
      sessionId: "11111111-1111-4111-8111-111111111111",
      text: "It was good."
    }));

    expect(response.status).toBe(400);
    expect(mockGetAnthropic).not.toHaveBeenCalled();
  });
});
