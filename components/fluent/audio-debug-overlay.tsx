"use client";

import { useEffect, useState } from "react";
import { logAudioDebug, setAudioDebugEnabled, subscribeAudioDebug, type AudioDebugEntry } from "@/lib/conversation/audio-debug";

const STORAGE_KEY = "fluent_audiodebug";
const TAP_COUNT_TO_TOGGLE = 5;
const TAP_WINDOW_MS = 1500;

// On-screen premium-audio log for debugging on a phone without Web Inspector.
// Enable it any of these ways (no need to remember a URL):
//   - tap the screen 5 times quickly, or
//   - add ?audiodebug=1 to the URL.
// The choice is persisted in localStorage so it survives in-app navigation.
export function AudioDebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [entries, setEntries] = useState<AudioDebugEntry[]>([]);

  function enable() {
    setAudioDebugEnabled(true);
    setEnabled(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Private mode can block storage; the panel still works for this session.
    }
    logAudioDebug(`panel on · ${navigator.userAgent}`);
  }

  function disable() {
    setAudioDebugEnabled(false);
    setEnabled(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stored = (() => {
      try {
        return window.localStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        return false;
      }
    })();

    if (params.get("audiodebug") === "1" || stored) enable();

    let tapCount = 0;
    let firstTapAt = 0;
    const onTap = () => {
      const now = Date.now();
      if (now - firstTapAt > TAP_WINDOW_MS) {
        tapCount = 0;
        firstTapAt = now;
      }
      tapCount += 1;
      if (tapCount >= TAP_COUNT_TO_TOGGLE) {
        tapCount = 0;
        setEnabled((current) => {
          if (current) {
            disable();
            return false;
          }
          enable();
          return true;
        });
      }
    };

    window.addEventListener("pointerdown", onTap);
    const unsubscribe = subscribeAudioDebug(setEntries);
    return () => {
      window.removeEventListener("pointerdown", onTap);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 8,
        right: 8,
        bottom: 8,
        maxHeight: "45vh",
        overflowY: "auto",
        zIndex: 99999,
        background: "rgba(0,0,0,0.88)",
        color: "#0f0",
        font: "11px/1.35 ui-monospace, Menlo, monospace",
        padding: "8px 10px",
        borderRadius: 8,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      }}
    >
      <div style={{ color: "#fff", marginBottom: 4 }}>
        audio debug ({entries.length}) · 5 taps to hide
      </div>
      {entries.map((entry, index) => (
        <div key={`${entry.t}-${index}`}>
          {new Date(entry.t).toLocaleTimeString()} · {entry.msg}
        </div>
      ))}
    </div>
  );
}
