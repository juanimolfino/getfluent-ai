import type { AiInput, AiProvider } from "@/lib/ai/types";
import type { JobType } from "@/lib/db/schema";
import { falImageProvider } from "./fal";
import { openAiTtsProvider } from "./openai-tts";

const providers = {
  image: falImageProvider,
  tts: openAiTtsProvider
} satisfies Record<JobType, AiProvider>;

export function getAiProvider(type: JobType): AiProvider<AiInput> {
  return providers[type] as AiProvider<AiInput>;
}
