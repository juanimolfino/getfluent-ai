import { NextResponse, type NextRequest } from "next/server";
import { ensureUserProfile, getJobForUser } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await ensureUserProfile(user);
  const { id } = await params;
  const job = await getJobForUser(id, profile.id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ job });
}
