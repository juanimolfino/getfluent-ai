import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { isPremiumUser } from "@/lib/billing/tier";
import { textToSpeech } from "@/lib/conversation/elevenlabs";

const ttsSchema = z.object({
  text: z.string().min(1).max(400)
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUserProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const premium = await isPremiumUser(user.id);
    if (!premium) return NextResponse.json({ error: "Premium required" }, { status: 403 });

    const body = await request.json();
    const parsed = ttsSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const audio = await textToSpeech(parsed.data.text);
    return new Response(new Uint8Array(audio.audioBuffer), {
      headers: {
        "Content-Type": audio.contentType,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Exercise TTS failed", error);
    return NextResponse.json({ error: "Could not generate audio" }, { status: 500 });
  }
}
