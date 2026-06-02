import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "../supabase/server";

const DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const PHRASE_CACHE_PREFIX = "fluent/phrase-cache/v1";
const AUDIO_CONTENT_TYPE = "audio/mpeg";

export const COMMON_ALEX_PHRASE_GROUPS = [
  {
    scenario: "greetings",
    phrases: [
      "Hi, I'm Alex. Let's warm up with a simple question: how are you today?",
      "Hi, I'm Alex. Tell me about your day so far.",
      "Hi, I'm Alex. What would you like to talk about today?",
      "Great to see you. Let's start with something easy.",
      "Let's start simple. How are you feeling right now?"
    ]
  },
  {
    scenario: "encouragement",
    phrases: [
      "That's interesting. Tell me more.",
      "Nice answer. Can you give me an example?",
      "Good. What happened next?",
      "I see. How did you feel about that?",
      "That makes sense. Can you explain why?",
      "Great. Let's keep going.",
      "Good job. Try adding one more detail.",
      "Nice. Say a little more about that.",
      "That's a useful way to say it.",
      "You're doing well. Keep your answer simple and clear.",
      "Good start. Now try to make it a full sentence.",
      "That's clear. Let's continue.",
      "Good point. Can you tell me more?"
    ]
  },
  {
    scenario: "closings",
    phrases: [
      "Thanks for the conversation. It was really nice talking with you. You can now open your analysis to see what went well and what to practice next.",
      "Great work today. You can now open your analysis and review what to practice next.",
      "Nice job. That is the end of our conversation. Go to your analysis to see your feedback.",
      "Thanks for practicing with me. It was nice talking with you.",
      "Good conversation. Now you can review your analysis and keep improving.",
      "That was a good practice session. Let's stop here and look at your analysis."
    ]
  }
] as const;

export const COMMON_ALEX_PHRASES = Array.from(new Set(COMMON_ALEX_PHRASE_GROUPS.flatMap((group) => group.phrases)));

const NORMALIZED_COMMON_PHRASES = COMMON_ALEX_PHRASES.map((phrase) => ({
  phrase,
  normalized: normalizePhraseText(phrase)
}));

export function getPhraseCacheVoiceId(voiceId = process.env.ELEVENLABS_VOICE_ID) {
  return voiceId?.trim() || DEFAULT_ELEVENLABS_VOICE_ID;
}

export function normalizePhraseText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

export function findExactCommonPhrase(text: string) {
  const normalized = normalizePhraseText(text);
  return NORMALIZED_COMMON_PHRASES.find((item) => item.normalized === normalized)?.phrase ?? null;
}

export function isCachedPhrase(text: string) {
  return Boolean(findExactCommonPhrase(text));
}

export function getPhraseCachePath(text: string, voiceId: string) {
  const normalized = normalizePhraseText(text);
  const cacheKey = createHash("sha256").update(`${voiceId}\n${normalized}`).digest("hex");
  const safeVoiceId = voiceId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${PHRASE_CACHE_PREFIX}/${safeVoiceId}/${cacheKey}.mp3`;
}

function getPhraseCacheBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET ?? "ai-audio-files";
}

function toArrayBuffer(input: Buffer | Uint8Array | ArrayBuffer) {
  if (input instanceof ArrayBuffer) return input;
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy.buffer;
}

export async function getCachedAudio(text: string, voiceId = getPhraseCacheVoiceId()): Promise<Buffer | null> {
  const path = getPhraseCachePath(text, voiceId);
  const { data, error } = await getSupabaseAdmin().storage.from(getPhraseCacheBucket()).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function cacheAudio(text: string, voiceId: string, audioBuffer: Buffer | Uint8Array | ArrayBuffer) {
  const path = getPhraseCachePath(text, voiceId);
  const { error } = await getSupabaseAdmin().storage.from(getPhraseCacheBucket()).upload(path, toArrayBuffer(audioBuffer), {
    upsert: true,
    contentType: AUDIO_CONTENT_TYPE
  });
  if (error) throw error;
  return path;
}
