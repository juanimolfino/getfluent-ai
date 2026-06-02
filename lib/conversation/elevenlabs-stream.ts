export type ElevenLabsCharAlignment = {
  chars: string[];
  charStartTimesMs: number[];
  charDurationsMs: number[];
};

export type ElevenLabsStreamOptions = {
  voiceId?: string;
  onAudioChunk: (chunk: Buffer) => void;
  onCharTimings?: (timings: ElevenLabsCharAlignment) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
};

export type ElevenLabsStream = {
  sendText: (text: string) => void;
  finish: () => void;
  close: () => void;
};

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const ELEVENLABS_WS_MODEL = "eleven_turbo_v2_5";

type ElevenLabsIncomingMessage = {
  audio?: string;
  isFinal?: boolean;
  alignment?: ElevenLabsCharAlignment;
  normalizedAlignment?: ElevenLabsCharAlignment;
};

function getApiKey() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required");
  return apiKey;
}

function parseIncomingMessage(raw: string): ElevenLabsIncomingMessage {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") return {};
  return parsed as ElevenLabsIncomingMessage;
}

async function messageDataToText(data: MessageEvent["data"]) {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (data instanceof Blob) return new TextDecoder().decode(await data.arrayBuffer());
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  return String(data);
}

function assertOpen(socket: WebSocket) {
  if (socket.readyState !== WebSocket.OPEN) {
    throw new Error("ElevenLabs WebSocket is not open");
  }
}

export async function createElevenLabsStream(options: ElevenLabsStreamOptions): Promise<ElevenLabsStream> {
  const apiKey = getApiKey();
  const voiceId = options.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
  const url = new URL(`wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input`);
  url.searchParams.set("model_id", ELEVENLABS_WS_MODEL);
  url.searchParams.set("sync_alignment", "true");

  const socket = new WebSocket(url);

  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => {
      // BOS primes the stream with voice settings and auth; text chunks arrive later via sendText().
      socket.send(JSON.stringify({
        text: " ",
        xi_api_key: apiKey,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        },
        generation_config: {
          chunk_length_schedule: [120, 160, 250, 290]
        }
      }));
      resolve();
    };

    socket.onerror = () => {
      const error = new Error("ElevenLabs WebSocket failed to open");
      options.onError?.(error);
      reject(error);
    };
  });

  socket.onmessage = async (event) => {
    try {
      const message = parseIncomingMessage(await messageDataToText(event.data));
      if (message.audio) options.onAudioChunk(Buffer.from(message.audio, "base64"));

      const timings = message.normalizedAlignment ?? message.alignment;
      if (timings) options.onCharTimings?.(timings);
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error("Could not parse ElevenLabs WebSocket message"));
    }
  };

  socket.onerror = () => {
    options.onError?.(new Error("ElevenLabs WebSocket error"));
  };

  socket.onclose = () => {
    options.onClose?.();
  };

  return {
    sendText(text: string) {
      assertOpen(socket);
      socket.send(JSON.stringify({
        text: text.endsWith(" ") ? text : `${text} `,
        try_trigger_generation: true
      }));
    },
    finish() {
      assertOpen(socket);
      // EOS tells ElevenLabs there is no more text and lets the server flush final audio.
      socket.send(JSON.stringify({ text: "" }));
    },
    close() {
      socket.close();
    }
  };
}
