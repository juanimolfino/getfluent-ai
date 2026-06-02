import Anthropic from "@anthropic-ai/sdk";

export const CONVERSATION_MODEL = "claude-sonnet-4-6";
export const CONVERSATION_MAX_TOKENS = 150;

let anthropic: Anthropic | null = null;

export function getAnthropic() {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

export function extractTextFromMessage(message: Anthropic.Messages.Message) {
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}
