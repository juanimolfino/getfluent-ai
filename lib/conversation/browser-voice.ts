"use client";

// BrowserVoicePlayer is the free-tier voice adapter for Alex's spoken replies.
export type VoicePlayer = {
  speak: (text: string) => void;
  setRate: (rate: number) => void;
  stop: () => void;
  isSpeaking: () => boolean;
  onStart: (callback: () => void) => void;
  onEnd: (callback: () => void) => void;
};

function pickEnglishVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const noveltyVoicePattern = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news|hysterical|jester|junior|kathy|organ|pipe organ|princess|ralph|superstar|trinoids|whisper|wobble|zarvox/i;
  const preferredNames = [
    "Samantha",
    "Google US English",
    "Microsoft Aria",
    "Microsoft Jenny",
    "Microsoft Guy",
    "Microsoft Davis",
    "Daniel",
    "Karen",
    "Moira",
    "Tessa",
    "Allison",
    "Ava",
    "Susan",
    "Victoria",
    "Tom",
    "Joanna",
    "Matthew",
    "Salli",
    "Kimberly",
    "Kendra"
  ];
  const usableVoices = englishVoices.filter((voice) => !noveltyVoicePattern.test(voice.name));

  for (const name of preferredNames) {
    const voice = usableVoices.find((item) => item.name.toLowerCase().includes(name.toLowerCase()));
    if (voice) return voice;
  }

  const naturalVoice = usableVoices.find((voice) => /natural|premium|enhanced|google|microsoft/i.test(voice.name));
  if (naturalVoice) return naturalVoice;

  const exactAmericanVoice = usableVoices.find((voice) => voice.lang.toLowerCase() === "en-us");
  if (exactAmericanVoice) return exactAmericanVoice;

  return null;
}

export function createBrowserVoicePlayer(): VoicePlayer {
  let speaking = false;
  let rate = 0.95;
  let onStartCallback: (() => void) | null = null;
  let onEndCallback: (() => void) | null = null;

  return {
    speak(text: string) {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) {
        onEndCallback?.();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.voice = pickEnglishVoice();
      speaking = true;

      const finish = () => {
        speaking = false;
        onEndCallback?.();
      };

      utterance.onstart = () => {
        speaking = true;
        onStartCallback?.();
      };
      utterance.onend = finish;
      utterance.onerror = finish;

      // Free tier speaks the full done text, not partial tokens, to avoid choppy restarts.
      window.speechSynthesis.speak(utterance);
    },
    setRate(nextRate: number) {
      rate = nextRate;
    },
    stop() {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      speaking = false;
    },
    isSpeaking() {
      return speaking;
    },
    onStart(callback: () => void) {
      onStartCallback = callback;
    },
    onEnd(callback: () => void) {
      onEndCallback = callback;
    }
  };
}
