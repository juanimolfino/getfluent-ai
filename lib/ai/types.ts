import type { JobType } from "@/lib/db/schema";

export type ImageInput = {
  prompt: string;
};

export type TtsInput = {
  text: string;
  voice?: "alloy" | "ash" | "ballad" | "coral" | "echo" | "fable" | "nova" | "onyx" | "sage" | "shimmer";
};

export type AiInput = ImageInput | TtsInput;

export type AiResult = {
  bytes: ArrayBuffer;
  contentType: string;
  extension: "png" | "mp3";
};

export type AiProvider<TInput extends AiInput = AiInput> = {
  type: JobType;
  costCredits: number;
  generate(input: TInput): Promise<AiResult>;
};
