import { describe, expect, it } from "vitest";
import { selectSpeechInputProvider, shouldAttemptDeepgramFluxInput } from "@/lib/conversation/speech-provider-selection";

describe("selectSpeechInputProvider", () => {
  it("uses browser speech recognition for free users", () => {
    expect(selectSpeechInputProvider({ isPremium: false, premiumSttProvider: "deepgram_flux" })).toBe("browser_speech_recognition");
    expect(shouldAttemptDeepgramFluxInput({ isPremium: false, premiumSttProvider: "deepgram_flux" })).toBe(false);
  });

  it("uses browser speech recognition for premium users unless the public flag enables Deepgram", () => {
    expect(selectSpeechInputProvider({ isPremium: true, premiumSttProvider: "browser" })).toBe("browser_speech_recognition");
    expect(selectSpeechInputProvider({ isPremium: true, premiumSttProvider: undefined })).toBe("browser_speech_recognition");
  });

  it("attempts Deepgram Flux for premium users when the public flag enables it", () => {
    expect(selectSpeechInputProvider({ isPremium: true, premiumSttProvider: "deepgram_flux" })).toBe("deepgram_flux");
    expect(shouldAttemptDeepgramFluxInput({ isPremium: true, premiumSttProvider: "deepgram_flux" })).toBe(true);
  });
});
