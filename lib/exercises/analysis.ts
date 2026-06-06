import { z } from "zod";

export const weakPointCategorySchema = z.enum(["grammar", "vocabulary", "fluency", "pronunciation"]);

export const weakPointSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  category: weakPointCategorySchema,
  explanation: z.string().min(1).max(700),
  userExample: z.string().min(1).max(500),
  betterVersion: z.string().min(1).max(500)
});

export const conversationAnalysisPayloadSchema = z.object({
  encouragement: z.string().min(1).max(700),
  weakPoints: z.array(weakPointSchema).max(3)
});

export const theorySchema = z.object({
  summary: z.string().min(1).max(900),
  examples: z.array(z.string().min(1).max(240)).min(2).max(3)
});

export type WeakPoint = z.infer<typeof weakPointSchema>;
export type WeakPointCategory = z.infer<typeof weakPointCategorySchema>;
export type ConversationAnalysisPayload = z.infer<typeof conversationAnalysisPayloadSchema>;
export type Theory = z.infer<typeof theorySchema>;
