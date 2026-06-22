import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getUserLanguageProfile, upsertUserLanguageProfile } from "@/lib/db/fluent-queries";
import { rejectForbiddenOrigin } from "@/lib/http/forbidden-origin";

const languageProfileSchema = z.object({
  nativeLanguage: z.enum(["spanish", "portuguese", "french", "italian", "german", "other"]).default("spanish"),
  englishLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  interests: z.array(z.string().min(1).max(40)).min(1).max(10),
  preferredTopics: z.array(z.string().min(1).max(40)).min(1).max(5)
});

export async function GET() {
  try {
    const user = await getCurrentUserProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getUserLanguageProfile(user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Language profile GET failed", error);
    return NextResponse.json({ error: "Could not load language profile" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const originResponse = rejectForbiddenOrigin(request, "user_profile_language");
    if (originResponse) return originResponse;

    const user = await getCurrentUserProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = languageProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const profile = await upsertUserLanguageProfile(user.id, parsed.data);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Language profile POST failed", error);
    return NextResponse.json({ error: "Could not save language profile" }, { status: 500 });
  }
}
