"use client";

import { useEffect, useState } from "react";
import { logAudioDebug, setAudioDebugEnabled, subscribeAudioDebug, type AudioDebugEntry } from "@/lib/conversation/audio-debug";

// Renders a fixed on-screen log panel only when the page URL includes ?audiodebug=1.
// Lets us read premium-audio diagnostics directly on a phone without Web Inspector.
export function AudioDebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [entries, setEntries] = useState<AudioDebugEntry[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("audiodebug") !== "1") return;

    setAudioDebugEnabled(true);
    setEnabled(true);
    logAudioDebug(`panel on · ${navigator.userAgent}`);
    return subscribeAudioDebug(setEntries);
  }, []);

  if (!enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 8,
        right: 8,
        bottom: 8,
        maxHeight: "40vh",
        overflowY: "auto",
        zIndex: 99999,
        background: "rgba(0,0,0,0.85)",
        color: "#0f0",
        font: "11px/1.35 ui-monospace, Menlo, monospace",
        padding: "8px 10px",
        borderRadius: 8,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      }}
    >
      <div style={{ color: "#fff", marginBottom: 4 }}>audio debug ({entries.length})</div>
      {entries.map((entry, index) => (
        <div key={`${entry.t}-${index}`}>
          {new Date(entry.t).toLocaleTimeString()} · {entry.msg}
        </div>
      ))}
    </div>
  );
}
