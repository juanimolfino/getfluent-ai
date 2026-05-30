import OpenAI from "openai";
import type { AiProvider, TtsInput } from "@/lib/ai/types";

let openai: OpenAI | null = null;

function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

export const openAiTtsProvider: AiProvider<TtsInput> = {
  type: "tts",
  costCredits: 1,
  async generate(input) {
    const response = await getOpenAI().audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: input.voice ?? "alloy",
      input: input.text,
      response_format: "mp3"
    });

    return {
      bytes: await response.arrayBuffer(),
      contentType: "audio/mpeg",
      extension: "mp3"
    };
  }
};
