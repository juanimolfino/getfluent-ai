export const ELEVENLABS_CHUNK_TARGET_CHARS = 20;

const SAFE_WORD_BOUNDARY_PATTERN = /[\s,.;:!?]/;

export type ElevenLabsSafeChunk = {
  chunk: string;
  rest: string;
};

function findLastSafeBoundaryIndex(buffer: string) {
  for (let index = buffer.length - 1; index >= 0; index -= 1) {
    if (SAFE_WORD_BOUNDARY_PATTERN.test(buffer[index])) return index;
  }

  return -1;
}

export function takeElevenLabsSafeChunk(buffer: string, force = false): ElevenLabsSafeChunk | null {
  if (!buffer.trim()) return null;

  if (force) return { chunk: buffer, rest: "" };

  const boundaryIndex = findLastSafeBoundaryIndex(buffer);
  if (boundaryIndex < 0) return null;

  const chunk = buffer.slice(0, boundaryIndex + 1);
  if (chunk.trim().length < 8 && buffer.length < ELEVENLABS_CHUNK_TARGET_CHARS) return null;
  if (buffer.length < ELEVENLABS_CHUNK_TARGET_CHARS && !SAFE_WORD_BOUNDARY_PATTERN.test(buffer[buffer.length - 1])) return null;

  return {
    chunk,
    rest: buffer.slice(boundaryIndex + 1)
  };
}
