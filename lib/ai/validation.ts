import { z } from "zod";

export const createJobSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("image"),
    input: z.object({
      prompt: z.string().min(3).max(1200)
    })
  }),
  z.object({
    type: z.literal("tts"),
    input: z.object({
      text: z.string().min(3).max(5000),
      voice: z.enum(["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"]).optional()
    })
  })
]);
