import { NextResponse } from "next/server";
import { createJobSchema } from "@/lib/ai/validation";
import { getAiProvider } from "@/lib/ai/providers";
import { createPendingJob, ensureUserProfile, refundJobCredits } from "@/lib/db/queries";
import { releaseJobSlot, reserveJobSlot } from "@/lib/redis/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import { rejectForbiddenOrigin } from "@/lib/http/forbidden-origin";
import type { Job } from "@/lib/db/schema";

export async function POST(request: Request) {
  const originResponse = rejectForbiddenOrigin(request, "jobs_create");
  if (originResponse) return originResponse;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const profile = await ensureUserProfile(user);
  const provider = getAiProvider(parsed.data.type);
  let reserved = false;
  let job: Job | null = null;

  try {
    await reserveJobSlot(profile.id);
    reserved = true;
    job = await createPendingJob({
      userId: profile.id,
      type: parsed.data.type,
      payload: parsed.data.input,
      creditsUsed: provider.costCredits
    });

    await inngest.send({
      name: "ai/job.created",
      data: { jobId: job.id }
    });

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    if (reserved) await releaseJobSlot(profile.id);
    if (job) await refundJobCredits(job.id, "Could not enqueue AI worker");
    const message = error instanceof Error ? error.message : "Could not create job";
    const status = message === "INSUFFICIENT_CREDITS" ? 402 : message === "RATE_LIMITED" ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
