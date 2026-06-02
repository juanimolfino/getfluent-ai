import { loadEnvConfig } from "@next/env";
import { writeFile } from "node:fs/promises";
import { createElevenLabsStream } from "../lib/conversation/elevenlabs-stream";

loadEnvConfig(process.cwd());

async function main() {
  const chunks: Buffer[] = [];
  let receivedTimings = false;
  let firstAudioChunkAt: number | null = null;
  const startedAt = performance.now();

  let resolveClosed: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });

  const stream = await createElevenLabsStream({
    onAudioChunk(chunk) {
      firstAudioChunkAt ??= Math.round(performance.now() - startedAt);
      chunks.push(chunk);
      console.log(`audio_chunk bytes=${chunk.length} total_chunks=${chunks.length}`);
    },
    onCharTimings(timings) {
      receivedTimings = true;
      console.log(`char_timings chars=${timings.chars.length}`);
    },
    onError(error) {
      console.error("elevenlabs_stream_error", error);
    },
    onClose() {
      console.log("elevenlabs_stream_closed");
      resolveClosed();
    }
  });

  stream.sendText("Hello there! ");
  stream.sendText("How are you ");
  stream.sendText("doing today?");
  stream.finish();

  let timeout: ReturnType<typeof setTimeout>;
  await Promise.race([
    closed.then(() => {
      clearTimeout(timeout);
    }),
    new Promise<void>((resolve) => {
      timeout = setTimeout(() => {
        console.log("elevenlabs_stream_timeout_closing");
        stream.close();
        resolve();
      }, 20000);
    })
  ]);

  if (chunks.length === 0) throw new Error("No audio chunks received from ElevenLabs");

  await writeFile("test-output.mp3", Buffer.concat(chunks));

  console.log(JSON.stringify({
    output: "test-output.mp3",
    chunks: chunks.length,
    bytes: chunks.reduce((total, chunk) => total + chunk.length, 0),
    receivedTimings,
    timeToFirstAudioChunkMs: firstAudioChunkAt
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
