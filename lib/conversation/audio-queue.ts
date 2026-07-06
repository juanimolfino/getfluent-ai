"use client";

import { logAudioDebug } from "@/lib/conversation/audio-debug";
import { getSharedAudioContext } from "@/lib/conversation/audio-unlock";

export type AudioQueue = {
  enqueue: (base64Chunk: string, seq: number) => void;
  start: () => void;
  stop: () => void;
  onStarted: (cb: () => void) => void;
  onEnded: (cb: () => void) => void;
  onError: (cb: (error: Error) => void) => void;
  isPlaying: () => boolean;
  getPlaybackTimeMs: () => number;
};

const MP3_MIME_TYPE = "audio/mpeg";
const MSE_IDLE_END_MS = 1200;

function decodeBase64(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function canUseMediaSource() {
  return typeof window !== "undefined" && "MediaSource" in window && MediaSource.isTypeSupported(MP3_MIME_TYPE);
}

function createNoopAudioQueue(): AudioQueue {
  return {
    enqueue() {},
    start() {},
    stop() {},
    onStarted() {},
    onEnded() {},
    onError() {},
    isPlaying() {
      return false;
    },
    getPlaybackTimeMs() {
      return 0;
    }
  };
}

function createMseAudioQueue(): AudioQueue {
  let audio: HTMLAudioElement | null = null;
  let mediaSource: MediaSource | null = null;
  let sourceBuffer: SourceBuffer | null = null;
  let objectUrl: string | null = null;
  let expectedSeq = 0;
  let started = false;
  let playing = false;
  let appendedAnyChunk = false;
  let playbackStartedAt = 0;
  let startCallback: (() => void) | null = null;
  let endCallback: (() => void) | null = null;
  let errorCallback: ((error: Error) => void) | null = null;
  let idleEndTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingChunks = new Map<number, Uint8Array>();

  function clearIdleEndTimer() {
    if (!idleEndTimer) return;
    clearTimeout(idleEndTimer);
    idleEndTimer = null;
  }

  function finishMediaSourceSoon() {
    clearIdleEndTimer();
    if (!started || !appendedAnyChunk || !mediaSource || mediaSource.readyState !== "open") return;
    idleEndTimer = setTimeout(() => {
      if (!sourceBuffer || sourceBuffer.updating || pendingChunks.has(expectedSeq) || mediaSource?.readyState !== "open") return;
      try {
        mediaSource.endOfStream();
      } catch {
        // The browser can throw if the stream ended between the timer and this call.
      }
    }, MSE_IDLE_END_MS);
  }

  function drain() {
    clearIdleEndTimer();
    if (!sourceBuffer || sourceBuffer.updating) return;

    const nextChunk = pendingChunks.get(expectedSeq);
    if (!nextChunk) {
      finishMediaSourceSoon();
      return;
    }

    pendingChunks.delete(expectedSeq);
    expectedSeq += 1;
    appendedAnyChunk = true;
    try {
      sourceBuffer.appendBuffer(toArrayBuffer(nextChunk));
    } catch (error) {
      errorCallback?.(error instanceof Error ? error : new Error("Could not append premium audio chunk"));
    }
  }

  function ensureMediaSource() {
    if (mediaSource) return;

    audio = new Audio();
    audio.preload = "auto";
    audio.addEventListener("playing", () => {
      playing = true;
      if (!playbackStartedAt) {
        playbackStartedAt = performance.now();
        startCallback?.();
      }
    });
    audio.addEventListener("pause", () => {
      playing = false;
    });
    audio.addEventListener("ended", () => {
      playing = false;
      endCallback?.();
    });
    audio.addEventListener("error", () => {
      errorCallback?.(new Error("Premium audio element failed"));
    });

    mediaSource = new MediaSource();
    objectUrl = URL.createObjectURL(mediaSource);
    audio.src = objectUrl;

    mediaSource.addEventListener("sourceopen", () => {
      if (!mediaSource || sourceBuffer) return;
      try {
        sourceBuffer = mediaSource.addSourceBuffer(MP3_MIME_TYPE);
      } catch (error) {
        errorCallback?.(error instanceof Error ? error : new Error("Could not create premium audio SourceBuffer"));
        return;
      }
      try {
        sourceBuffer.mode = "sequence";
      } catch {
        // Some browsers keep MP3 SourceBuffers in segments mode; appending still works in order.
      }
      sourceBuffer.addEventListener("error", () => {
        errorCallback?.(new Error("Premium audio SourceBuffer failed"));
      });
      sourceBuffer.addEventListener("updateend", drain);
      drain();
    });
    mediaSource.addEventListener("sourceended", () => {
      playing = false;
    });
  }

  return {
    enqueue(base64Chunk, seq) {
      pendingChunks.set(seq, decodeBase64(base64Chunk));
      if (started) ensureMediaSource();
      drain();
    },
    start() {
      started = true;
      ensureMediaSource();
      void audio?.play();
    },
    stop() {
      clearIdleEndTimer();
      started = false;
      playing = false;
      pendingChunks.clear();
      audio?.pause();
      audio?.removeAttribute("src");
      audio?.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      audio = null;
      mediaSource = null;
      sourceBuffer = null;
      objectUrl = null;
      expectedSeq = 0;
      appendedAnyChunk = false;
      playbackStartedAt = 0;
    },
    onEnded(cb) {
      endCallback = cb;
    },
    onStarted(cb) {
      startCallback = cb;
    },
    onError(cb) {
      errorCallback = cb;
    },
    isPlaying() {
      return playing;
    },
    getPlaybackTimeMs() {
      if (!audio) return 0;
      return Math.round(audio.currentTime * 1000);
    }
  };
}

function createWebAudioQueue(): AudioQueue {
  let audioContext: AudioContext | null = null;
  let expectedSeq = 0;
  let nextStartTime = 0;
  let playbackStartedAt = 0;
  let startTimer: ReturnType<typeof setTimeout> | null = null;
  let startCallback: (() => void) | null = null;
  let playing = false;
  let draining = false;
  let endCallback: (() => void) | null = null;
  let errorCallback: ((error: Error) => void) | null = null;
  const pendingChunks = new Map<number, Uint8Array>();
  const activeSources = new Set<AudioBufferSourceNode>();

  function ensureContext() {
    // Reuse the shared, already-unlocked context so mobile playback keeps working
    // across turns instead of being re-suspended on every new AudioContext.
    audioContext ??= getSharedAudioContext() ?? new AudioContext();
    return audioContext;
  }

  async function drain() {
    if (draining) return;
    draining = true;

    try {
      const context = ensureContext();
      const stateBefore = context.state;
      await context.resume();
      if (stateBefore !== context.state) logAudioDebug(`ctx ${stateBefore} → ${context.state}`);
      else logAudioDebug(`ctx state=${context.state}`);

      while (pendingChunks.has(expectedSeq)) {
        const chunk = pendingChunks.get(expectedSeq);
        if (!chunk) break;
        pendingChunks.delete(expectedSeq);
        expectedSeq += 1;

        let audioBuffer: AudioBuffer;
        try {
          audioBuffer = await context.decodeAudioData(toArrayBuffer(chunk));
        } catch (decodeError) {
          logAudioDebug(`decode FAIL seq=${expectedSeq - 1} bytes=${chunk.byteLength} err=${decodeError instanceof Error ? decodeError.message : String(decodeError)}`);
          throw decodeError;
        }
        logAudioDebug(`decode ok seq=${expectedSeq - 1} dur=${audioBuffer.duration.toFixed(2)}s`);
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);

        const startAt = Math.max(nextStartTime, context.currentTime + 0.02);
        if (!playbackStartedAt) {
          const delayMs = Math.max(0, startAt - context.currentTime) * 1000;
          playbackStartedAt = performance.now() + delayMs;
          startTimer = setTimeout(() => {
            startTimer = null;
            if (playing) startCallback?.();
          }, delayMs);
        }
        source.start(startAt);
        logAudioDebug(`source.start seq=${expectedSeq - 1} at=${startAt.toFixed(2)} ctxTime=${context.currentTime.toFixed(2)}`);
        nextStartTime = startAt + audioBuffer.duration;
        playing = true;
        activeSources.add(source);
        source.onended = () => {
          activeSources.delete(source);
          if (activeSources.size === 0 && !pendingChunks.has(expectedSeq)) {
            playing = false;
            endCallback?.();
          }
        };
      }
    } catch (error) {
      logAudioDebug(`drain error → fallback: ${error instanceof Error ? error.message : String(error)}`);
      errorCallback?.(error instanceof Error ? error : new Error("Could not decode premium audio chunk"));
    } finally {
      draining = false;
    }
  }

  return {
    enqueue(base64Chunk, seq) {
      pendingChunks.set(seq, decodeBase64(base64Chunk));
      void drain();
    },
    start() {
      const context = ensureContext();
      logAudioDebug(`WebAudio start() ctx=${context.state}`);
      void context.resume();
      void drain();
    },
    stop() {
      if (startTimer) {
        clearTimeout(startTimer);
        startTimer = null;
      }
      pendingChunks.clear();
      activeSources.forEach((source) => {
        try {
          source.stop();
        } catch {
          // Ignore already-ended sources.
        }
      });
      activeSources.clear();
      expectedSeq = 0;
      nextStartTime = 0;
      playbackStartedAt = 0;
      playing = false;
      // Release the local reference but keep the shared context alive (and unlocked)
      // so the next turn does not need another user gesture to play.
      audioContext = null;
    },
    onEnded(cb) {
      endCallback = cb;
    },
    onStarted(cb) {
      startCallback = cb;
    },
    onError(cb) {
      errorCallback = cb;
    },
    isPlaying() {
      return playing;
    },
    getPlaybackTimeMs() {
      if (!playbackStartedAt) return 0;
      return Math.max(0, Math.round(performance.now() - playbackStartedAt));
    }
  };
}

export function createAudioQueue(): AudioQueue {
  if (typeof window === "undefined") return createNoopAudioQueue();
  const useMse = canUseMediaSource();
  logAudioDebug(`createAudioQueue → ${useMse ? "MSE" : "WebAudio"}`);
  return useMse ? createMseAudioQueue() : createWebAudioQueue();
}
