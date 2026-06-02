export type TTSResult = {
  audioBuffer: Buffer;
  contentType: "audio/mpeg";
};

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export async function textToSpeech(text: string, options?: { voiceId?: string }): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required");

  const voiceId = options?.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs TTS failed with ${response.status}: ${body}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return { audioBuffer, contentType: "audio/mpeg" };
}
