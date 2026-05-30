import { NextResponse, type NextRequest } from "next/server";
import { createSignedResultUrl } from "@/lib/ai/storage";
import { ensureUserProfile, getJobForUser } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await ensureUserProfile(user);
  const { id } = await params;
  const job = await getJobForUser(id, profile.id);
  if (!job || !job.resultUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const signedUrl = await createSignedResultUrl(job.resultUrl, {
    download: request.nextUrl.searchParams.get("download") === "1"
  });

  return NextResponse.redirect(signedUrl);
}
