import { loadEnvConfig } from "@next/env";
import { cacheAudio, COMMON_ALEX_PHRASES, getCachedAudio, getPhraseCacheVoiceId } from "../lib/conversation/phrase-cache";
import { textToSpeech } from "../lib/conversation/elevenlabs";

loadEnvConfig(process.cwd());

async function main() {
  const voiceId = getPhraseCacheVoiceId();
  let generated = 0;
  let skipped = 0;

  console.log(`Pregenerating ${COMMON_ALEX_PHRASES.length} Alex phrase audios for voiceId=${voiceId}`);

  for (const phrase of COMMON_ALEX_PHRASES) {
    const cached = await getCachedAudio(phrase, voiceId);
    if (cached) {
      skipped += 1;
      console.log(`skip cached: ${phrase}`);
      continue;
    }

    const { audioBuffer } = await textToSpeech(phrase, { voiceId });
    const path = await cacheAudio(phrase, voiceId, audioBuffer);
    generated += 1;
    console.log(`cached: ${path}`);
  }

  console.log(JSON.stringify({ voiceId, phrases: COMMON_ALEX_PHRASES.length, generated, skipped }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
