import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/practice/:path*", "/login", "/api/jobs/:path*", "/api/conversation/:path*", "/api/user-profile/:path*"]
};
