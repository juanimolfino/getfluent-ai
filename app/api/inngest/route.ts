import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { runAiJob } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runAiJob],
  signingKey: process.env.INNGEST_SIGNING_KEY
});
