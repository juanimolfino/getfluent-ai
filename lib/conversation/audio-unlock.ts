"use client";

// Mobile browsers (especially iOS Safari) block programmatic audio playback until
// it has been triggered inside a real user gesture. This module centralizes the
// unlock so both the free-tier speechSynthesis voice and the premium Web Audio
// queue can share a single primed AudioContext.

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

let sharedAudioContext: AudioContext | null = null;
let unlocked = false;

export function audioRequiresUserGesture() {
  if (typeof window === "undefined") return false;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  return coarsePointer || hasTouch;
}

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new Ctor();
    } catch {
      return null;
    }
  }
  return sharedAudioContext;
}

export function isAudioUnlocked() {
  return unlocked;
}

// Must be called from within a user gesture handler to take effect on mobile.
export function unlockAudioPlayback() {
  if (typeof window === "undefined") return;

  const context = getSharedAudioContext();
  void context?.resume().catch(() => {});

  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.resume();
      // A near-silent utterance primes the engine so later programmatic speak() calls
      // are allowed. getVoices() also starts loading as a side effect.
      const warmup = new SpeechSynthesisUtterance(" ");
      warmup.volume = 0;
      window.speechSynthesis.speak(warmup);
    } catch {
      // Ignore engines that reject the warmup utterance.
    }
  }

  unlocked = true;
}
