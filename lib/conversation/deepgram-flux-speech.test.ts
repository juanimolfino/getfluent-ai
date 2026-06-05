import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeepgramFluxSpeechProvider } from "@/lib/conversation/deepgram-flux-speech";

class FakeSocket {
  readyState = 0;
  sent: unknown[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.({} as CloseEvent);
  }

  open() {
    this.readyState = 1;
    this.onopen?.({} as Event);
  }

  message(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

class FakeMediaRecorder {
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  start = vi.fn();
  stop = vi.fn();

  constructor(_stream: MediaStream, _options: MediaRecorderOptions) {}

  emitAudio(data = new Blob(["audio"])) {
    this.ondataavailable?.({ data } as BlobEvent);
  }
}

function createMediaDevices() {
  const stopTrack = vi.fn();
  return {
    stopTrack,
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: stopTrack }]
      } as unknown as MediaStream)
    }
  };
}

function tokenResponse(token = "temporary-token") {
  return new Response(JSON.stringify(tokenBody(token)), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function tokenBody(token = "temporary-token") {
  return {
    accessToken: token,
    expiresIn: 30,
    websocketUrl: "wss://api.deepgram.com/v2/listen?model=flux-general-en",
    model: "flux-general-en",
    provider: "deepgram_flux"
  } as const;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("createDeepgramFluxSpeechProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back when the token endpoint fails", async () => {
    const onFallback = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    const webSocketFactory = vi.fn();
    const { mediaDevices } = createMediaDevices();

    const provider = createDeepgramFluxSpeechProvider({
      fetchImpl,
      webSocketFactory,
      mediaDevices,
      mediaRecorderFactory: (stream, options) => new FakeMediaRecorder(stream, options) as unknown as MediaRecorder,
      isMimeTypeSupported: () => true,
      onFallback
    });

    await provider.start();

    expect(onFallback).toHaveBeenCalledWith("token_endpoint_500");
    expect(webSocketFactory).not.toHaveBeenCalled();
  });

  it("does not open a WebSocket after cancellation during token fetch", async () => {
    const tokenDeferred = createDeferred<Response>();
    const fetchImpl = vi.fn().mockReturnValue(tokenDeferred.promise);
    const webSocketFactory = vi.fn();
    const { mediaDevices } = createMediaDevices();

    const provider = createDeepgramFluxSpeechProvider({
      fetchImpl,
      webSocketFactory,
      mediaDevices,
      mediaRecorderFactory: (stream, options) => new FakeMediaRecorder(stream, options) as unknown as MediaRecorder,
      isMimeTypeSupported: () => true
    });

    const startPromise = provider.start();
    provider.cancel();
    tokenDeferred.resolve(tokenResponse());
    await startPromise;

    expect(webSocketFactory).not.toHaveBeenCalled();
  });

  it("starts local recording before the token request finishes", async () => {
    const tokenDeferred = createDeferred<Response>();
    const fetchImpl = vi.fn().mockReturnValue(tokenDeferred.promise);
    const socket = new FakeSocket();
    const recorderRef: { current: FakeMediaRecorder | null } = { current: null };
    const { mediaDevices } = createMediaDevices();

    const provider = createDeepgramFluxSpeechProvider({
      fetchImpl,
      webSocketFactory: () => socket as unknown as WebSocket,
      mediaDevices,
      mediaRecorderFactory: (stream, options) => {
        recorderRef.current = new FakeMediaRecorder(stream, options);
        return recorderRef.current as unknown as MediaRecorder;
      },
      isMimeTypeSupported: () => true
    });

    const startPromise = provider.start();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(recorderRef.current?.start).toHaveBeenCalledWith(80);

    tokenDeferred.resolve(tokenResponse());
    await startPromise;
    provider.cancel();
  });

  it("buffers local audio until the Deepgram WebSocket opens", async () => {
    const socket = new FakeSocket();
    const recorderRef: { current: FakeMediaRecorder | null } = { current: null };
    const { mediaDevices } = createMediaDevices();

    const provider = createDeepgramFluxSpeechProvider({
      fetchImpl: vi.fn().mockResolvedValue(tokenResponse()),
      webSocketFactory: () => socket as unknown as WebSocket,
      mediaDevices,
      mediaRecorderFactory: (stream, options) => {
        recorderRef.current = new FakeMediaRecorder(stream, options);
        return recorderRef.current as unknown as MediaRecorder;
      },
      isMimeTypeSupported: () => true
    });

    await provider.start();
    recorderRef.current?.emitAudio();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(socket.sent).toHaveLength(0);

    socket.open();

    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]).toBeInstanceOf(ArrayBuffer);
    provider.cancel();
  });

  it("uses a prefetched token without calling the token endpoint", async () => {
    let clock = 100;
    const socket = new FakeSocket();
    const fetchImpl = vi.fn();
    const webSocketFactory = vi.fn((_url: string, _protocols: string[]) => socket as unknown as WebSocket);
    const onMetrics = vi.fn();
    const { mediaDevices } = createMediaDevices();

    const provider = createDeepgramFluxSpeechProvider({
      prefetchedTokenPromise: Promise.resolve(tokenBody("prefetched-token")),
      fetchImpl,
      webSocketFactory,
      mediaDevices,
      mediaRecorderFactory: (stream, options) => new FakeMediaRecorder(stream, options) as unknown as MediaRecorder,
      isMimeTypeSupported: () => true,
      now: () => clock,
      onMetrics
    });

    await provider.start();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(webSocketFactory).toHaveBeenCalledWith("wss://api.deepgram.com/v2/listen?model=flux-general-en", ["bearer", "prefetched-token"]);
    expect(onMetrics).toHaveBeenCalledWith(expect.objectContaining({ provider: "deepgram_flux", tokenFetchMs: 0 }));
  });

  it("keeps recording while a pending prefetched token resolves", async () => {
    const tokenDeferred = createDeferred<ReturnType<typeof tokenBody>>();
    const socket = new FakeSocket();
    const recorderRef: { current: FakeMediaRecorder | null } = { current: null };
    const { mediaDevices } = createMediaDevices();

    const provider = createDeepgramFluxSpeechProvider({
      prefetchedTokenPromise: tokenDeferred.promise,
      fetchImpl: vi.fn(),
      webSocketFactory: () => socket as unknown as WebSocket,
      mediaDevices,
      mediaRecorderFactory: (stream, options) => {
        recorderRef.current = new FakeMediaRecorder(stream, options);
        return recorderRef.current as unknown as MediaRecorder;
      },
      isMimeTypeSupported: () => true
    });

    const startPromise = provider.start();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(recorderRef.current?.start).toHaveBeenCalledWith(80);

    tokenDeferred.resolve(tokenBody("pending-prefetch-token"));
    await startPromise;
    provider.cancel();
  });

  it("falls back to browser-compatible handling when the token endpoint returns 403", async () => {
    const onFallback = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 403 }));
    const webSocketFactory = vi.fn();
    const { mediaDevices } = createMediaDevices();

    const provider = createDeepgramFluxSpeechProvider({
      fetchImpl,
      webSocketFactory,
      mediaDevices,
      mediaRecorderFactory: (stream, options) => new FakeMediaRecorder(stream, options) as unknown as MediaRecorder,
      isMimeTypeSupported: () => true,
      onFallback
    });

    await provider.start();

    expect(onFallback).toHaveBeenCalledWith("token_endpoint_403");
    expect(webSocketFactory).not.toHaveBeenCalled();
  });

  it("falls back when MediaRecorder has no supported Opus container", async () => {
    const onFallback = vi.fn();
    const fetchImpl = vi.fn();
    const { mediaDevices } = createMediaDevices();

    const provider = createDeepgramFluxSpeechProvider({
      fetchImpl,
      mediaDevices,
      webSocketFactory: vi.fn(),
      mediaRecorderFactory: (stream, options) => new FakeMediaRecorder(stream, options) as unknown as MediaRecorder,
      isMimeTypeSupported: () => false,
      onFallback
    });

    await provider.start();

    expect(onFallback).toHaveBeenCalledWith("media_recorder_unsupported");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not log the temporary access token", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const socket = new FakeSocket();
    const { mediaDevices } = createMediaDevices();
    const onPartialTranscript = vi.fn();
    const onFinalTranscript = vi.fn();

    const provider = createDeepgramFluxSpeechProvider({
      fetchImpl: vi.fn().mockResolvedValue(tokenResponse("secret-temporary-token")),
      webSocketFactory: () => socket as unknown as WebSocket,
      mediaDevices,
      mediaRecorderFactory: (stream, options) => new FakeMediaRecorder(stream, options) as unknown as MediaRecorder,
      isMimeTypeSupported: () => true,
      onPartialTranscript,
      onFinalTranscript
    });

    await provider.start();
    socket.open();
    socket.message(JSON.stringify({
      type: "TurnInfo",
      event: "Update",
      turn_index: 1,
      transcript: "hello"
    }));
    socket.message(JSON.stringify({
      type: "TurnInfo",
      event: "EndOfTurn",
      turn_index: 1,
      transcript: "hello"
    }));
    provider.cancel();

    const logged = [...consoleLog.mock.calls, ...consoleError.mock.calls].flat().join(" ");
    expect(logged).not.toContain("secret-temporary-token");
    expect(onPartialTranscript).toHaveBeenCalledWith(expect.objectContaining({ transcript: "hello" }));
    expect(onFinalTranscript).toHaveBeenCalledWith(expect.objectContaining({ transcript: "hello" }));
  });

  it("uses Bearer WebSocket subprotocol for temporary tokens", async () => {
    const socket = new FakeSocket();
    const webSocketFactory = vi.fn((_url: string, _protocols: string[]) => socket as unknown as WebSocket);
    const { mediaDevices } = createMediaDevices();

    const provider = createDeepgramFluxSpeechProvider({
      fetchImpl: vi.fn().mockResolvedValue(tokenResponse("temporary-jwt")),
      webSocketFactory,
      mediaDevices,
      mediaRecorderFactory: (stream, options) => new FakeMediaRecorder(stream, options) as unknown as MediaRecorder,
      isMimeTypeSupported: () => true
    });

    await provider.start();

    expect(webSocketFactory).toHaveBeenCalledWith("wss://api.deepgram.com/v2/listen?model=flux-general-en", ["bearer", "temporary-jwt"]);
  });

  it("sends sessionId in the token request body without putting the access token in the URL", async () => {
    const socket = new FakeSocket();
    const fetchImpl = vi.fn().mockResolvedValue(tokenResponse("temporary-jwt"));
    const webSocketFactory = vi.fn((_url: string, _protocols: string[]) => socket as unknown as WebSocket);
    const { mediaDevices } = createMediaDevices();

    const provider = createDeepgramFluxSpeechProvider({
      sessionId: "11111111-1111-4111-8111-111111111111",
      fetchImpl,
      webSocketFactory,
      mediaDevices,
      mediaRecorderFactory: (stream, options) => new FakeMediaRecorder(stream, options) as unknown as MediaRecorder,
      isMimeTypeSupported: () => true
    });

    await provider.start();

    const websocketUrl = webSocketFactory.mock.calls[0]?.[0] as string;
    expect(fetchImpl).toHaveBeenCalledWith("/api/stt/deepgram-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "11111111-1111-4111-8111-111111111111" })
    });
    expect(websocketUrl).not.toContain("temporary-jwt");
    expect(websocketUrl).not.toContain("access_token");
  });

  it("does not reconnect in a loop when the Deepgram WebSocket errors", async () => {
    const socket = new FakeSocket();
    const onFallback = vi.fn();
    const webSocketFactory = vi.fn(() => socket as unknown as WebSocket);
    const { mediaDevices } = createMediaDevices();

    const provider = createDeepgramFluxSpeechProvider({
      fetchImpl: vi.fn().mockResolvedValue(tokenResponse()),
      webSocketFactory,
      mediaDevices,
      mediaRecorderFactory: (stream, options) => new FakeMediaRecorder(stream, options) as unknown as MediaRecorder,
      isMimeTypeSupported: () => true,
      onFallback
    });

    await provider.start();
    socket.onerror?.({} as Event);

    expect(webSocketFactory).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledWith("deepgram_ws_error");
  });

  it("does not emit duplicate final transcripts for repeated EndOfTurn messages", async () => {
    const socket = new FakeSocket();
    const { mediaDevices } = createMediaDevices();
    const onFinalTranscript = vi.fn();

    const provider = createDeepgramFluxSpeechProvider({
      fetchImpl: vi.fn().mockResolvedValue(tokenResponse()),
      webSocketFactory: () => socket as unknown as WebSocket,
      mediaDevices,
      mediaRecorderFactory: (stream, options) => new FakeMediaRecorder(stream, options) as unknown as MediaRecorder,
      isMimeTypeSupported: () => true,
      onFinalTranscript
    });

    await provider.start();
    socket.open();

    const finalMessage = JSON.stringify({
      type: "TurnInfo",
      event: "EndOfTurn",
      turn_index: 2,
      transcript: "I want to practice more."
    });
    socket.message(finalMessage);
    socket.message(finalMessage);
    provider.cancel();

    expect(onFinalTranscript).toHaveBeenCalledTimes(1);
  });
});
