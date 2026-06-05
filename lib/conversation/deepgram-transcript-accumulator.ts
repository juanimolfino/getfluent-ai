export function buildAccumulatedDeepgramTranscript(segments: Map<number, string>) {
  return [...segments.entries()]
    .sort(([firstIndex], [secondIndex]) => firstIndex - secondIndex)
    .map(([, transcript]) => transcript.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function upsertDeepgramTranscriptSegment(segments: Map<number, string>, turnIndex: number, transcript: string) {
  const trimmedTranscript = transcript.trim();
  if (trimmedTranscript) {
    segments.set(turnIndex, trimmedTranscript);
  }
  return buildAccumulatedDeepgramTranscript(segments);
}
