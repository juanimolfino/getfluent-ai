import type { SpeechInputProvider } from "@/lib/conversation/speech-input";

export type PremiumSttProviderFlag = "browser" | "deepgram_flux";

export function normalizePremiumSttProviderFlag(value?: string | null): PremiumSttProviderFlag {
  return value === "deepgram_flux" ? "deepgram_flux" : "browser";
}

export function selectSpeechInputProvider({
  isPremium,
  premiumSttProvider
}: {
  isPremium: boolean;
  premiumSttProvider?: string | null;
}): SpeechInputProvider {
  if (isPremium && normalizePremiumSttProviderFlag(premiumSttProvider) === "deepgram_flux") {
    return "deepgram_flux";
  }

  return "browser_speech_recognition";
}

export function shouldAttemptDeepgramFluxInput(options: {
  isPremium: boolean;
  premiumSttProvider?: string | null;
}) {
  return selectSpeechInputProvider(options) === "deepgram_flux";
}
