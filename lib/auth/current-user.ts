import { ensureUserProfile } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUserProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;
  return ensureUserProfile(user);
}
