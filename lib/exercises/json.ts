export function stripJsonMarkdown(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseJsonObject(value: string): unknown {
  return JSON.parse(stripJsonMarkdown(value));
}
