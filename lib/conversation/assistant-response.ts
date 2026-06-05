const FOLLOW_UP_QUESTION = "What do you think?";

export function getConversationFollowUpDelta(text: string, isFinalTurn: boolean) {
  if (isFinalTurn) return "";

  const trimmed = text.trim();
  if (trimmed.includes("?")) return "";
  if (!trimmed) return FOLLOW_UP_QUESTION;

  const separator = /[.!]$/.test(trimmed) ? " " : ". ";
  return `${separator}${FOLLOW_UP_QUESTION}`;
}
