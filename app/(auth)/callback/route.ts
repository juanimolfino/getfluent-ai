import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ensureUserProfile } from "@/lib/db/queries";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");
  const loginUrl = new URL("/login", request.url);
  const dashboardUrl = new URL("/dashboard", request.url);

  if (error || !code) {
    loginUrl.searchParams.set("error", error ?? "Missing auth code");
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.redirect(dashboardUrl);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, { ...options, path: "/" });
          });
        }
      }
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    loginUrl.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(loginUrl);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    loginUrl.searchParams.set("error", "Could not load authenticated user");
    return NextResponse.redirect(loginUrl);
  }

  try {
    await ensureUserProfile(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown profile setup error";
    console.error("Auth callback profile setup failed", { message });
    loginUrl.searchParams.set("error", `Profile setup failed: ${message}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
