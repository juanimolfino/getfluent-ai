"use client";

import { createAudioQueue, type AudioQueue } from "@/lib/conversation/audio-queue";

export type PremiumTimingChar = {
  char: string;
  startMs: number;
  durationMs: number;
};

export type PremiumVoicePlayer = {
  speak: (text: string) => void;
  setText: (text: string) => void;
  stop: () => void;
  isSpeaking: () => boolean;
  onStart: (callback: () => void) => void;
  onEnd: (callback: () => void) => void;
  onError: (callback: (error: Error) => void) => void;
  enqueueAudio: (base64Chunk: string, seq: number) => void;
  addTimings: (chars: PremiumTimingChar[]) => void;
  getRevealedText: () => string;
  onReveal: (callback: (text: string) => void) => void;
};

const APPROX_CHARS_PER_SECOND = 15;
const MIN_APPROX_DURATION_MS = 1200;

export function createPremiumVoicePlayer(): PremiumVoicePlayer {
  let audioQueue: AudioQueue = createAudioQueue();
  let fullText = "";
  let revealedText = "";
  let speaking = false;
  let startedAt = 0;
  let revealTimer: ReturnType<typeof requestAnimationFrame> | null = null;
  let timings: PremiumTimingChar[] = [];
  let onStartCallback: (() => void) | null = null;
  let onEndCallback: (() => void) | null = null;
  let onErrorCallback: ((error: Error) => void) | null = null;
  let onRevealCallback: ((text: string) => void) | null = null;

  function emitReveal(nextText: string) {
    if (nextText === revealedText) return;
    revealedText = nextText;
    onRevealCallback?.(revealedText);
  }

  function getTimingReveal(playbackMs: number) {
    const visibleChars = timings.filter((item) => item.startMs <= playbackMs + Math.max(40, item.durationMs * 0.35));
    return visibleChars.map((item) => item.char).join("");
  }

  function getApproximateReveal() {
    if (!startedAt || !fullText) return "";
    const elapsedMs = performance.now() - startedAt;
    const estimatedDurationMs = Math.max(MIN_APPROX_DURATION_MS, (fullText.length / APPROX_CHARS_PER_SECOND) * 1000);
    const progress = Math.min(1, elapsedMs / estimatedDurationMs);
    return fullText.slice(0, Math.ceil(fullText.length * progress));
  }

  function tickReveal() {
    if (!speaking) return;

    const playbackMs = audioQueue.getPlaybackTimeMs();
    const nextText = timings.length ? getTimingReveal(playbackMs) : getApproximateReveal();
    emitReveal(nextText);

    if (nextText.length >= fullText.length && fullText) {
      emitReveal(fullText);
    }

    revealTimer = requestAnimationFrame(tickReveal);
  }

  function cancelRevealTimer() {
    if (revealTimer === null) return;
    cancelAnimationFrame(revealTimer);
    revealTimer = null;
  }

  function resetQueue() {
    audioQueue.stop();
    audioQueue = createAudioQueue();
    audioQueue.onEnded(() => {
      speaking = false;
      cancelRevealTimer();
      emitReveal(fullText);
      onEndCallback?.();
    });
    audioQueue.onError((error) => {
      onErrorCallback?.(error);
    });
  }

  audioQueue.onEnded(() => {
    speaking = false;
    cancelRevealTimer();
    emitReveal(fullText);
    onEndCallback?.();
  });
  audioQueue.onError((error) => {
    onErrorCallback?.(error);
  });

  return {
    speak(text: string) {
      resetQueue();
      fullText = text;
      revealedText = "";
      timings = [];
      startedAt = performance.now();
      speaking = true;
      onStartCallback?.();
      onRevealCallback?.("");
      audioQueue.start();
      cancelRevealTimer();
      revealTimer = requestAnimationFrame(tickReveal);
    },
    setText(text: string) {
      fullText = text;
    },
    stop() {
      speaking = false;
      cancelRevealTimer();
      audioQueue.stop();
      revealedText = "";
    },
    isSpeaking() {
      return speaking || audioQueue.isPlaying();
    },
    onStart(callback: () => void) {
      onStartCallback = callback;
    },
    onEnd(callback: () => void) {
      onEndCallback = callback;
    },
    onError(callback: (error: Error) => void) {
      onErrorCallback = callback;
    },
    enqueueAudio(base64Chunk: string, seq: number) {
      audioQueue.enqueue(base64Chunk, seq);
    },
    addTimings(chars: PremiumTimingChar[]) {
      timings = [...timings, ...chars].sort((first, second) => first.startMs - second.startMs);
    },
    getRevealedText() {
      return revealedText;
    },
    onReveal(callback: (text: string) => void) {
      onRevealCallback = callback;
    }
  };
}
