"use client";

// Temporary on-screen audio diagnostics. No-op unless explicitly enabled (via the
// ?audiodebug=1 URL param handled by AudioDebugOverlay), so it has zero impact on
// normal users. Used to debug why premium (ElevenLabs) audio is silent on iOS Safari.

export type AudioDebugEntry = { t: number; msg: string };

const MAX_ENTRIES = 60;
let entries: AudioDebugEntry[] = [];
let enabled = false;
const listeners = new Set<(entries: AudioDebugEntry[]) => void>();

export function setAudioDebugEnabled(value: boolean) {
  enabled = value;
}

export function isAudioDebugEnabled() {
  return enabled;
}

export function logAudioDebug(msg: string) {
  if (!enabled) return;
  entries = [...entries.slice(-(MAX_ENTRIES - 1)), { t: Date.now(), msg }];
  listeners.forEach((cb) => cb(entries));
}

export function subscribeAudioDebug(cb: (entries: AudioDebugEntry[]) => void) {
  listeners.add(cb);
  cb(entries);
  return () => {
    listeners.delete(cb);
  };
}
