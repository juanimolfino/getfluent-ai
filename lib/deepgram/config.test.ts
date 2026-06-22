import { describe, expect, it } from "vitest";
import {
  DeepgramConfigError,
  buildDeepgramFluxWebSocketUrl,
  getDeepgramServerConfig
} from "@/lib/deepgram/config";

describe("getDeepgramServerConfig", () => {
  it("uses safe defaults for Flux configuration", () => {
    const config = getDeepgramServerConfig({ DEEPGRAM_API_KEY: "server-key" });

    expect(config).toMatchObject({
      apiKey: "server-key",
      ttlSeconds: 30,
      model: "flux-general-en",
      eotThreshold: 0.9,
      eotTimeoutMs: 10000
    });
    expect(config.websocketUrl).toBe(
      "wss://api.deepgram.com/v2/listen?model=flux-general-en&eot_threshold=0.9&eot_timeout_ms=10000"
    );
  });

  it("parses custom env values", () => {
    const config = getDeepgramServerConfig({
      DEEPGRAM_API_KEY: "server-key",
      DEEPGRAM_TEMP_TOKEN_TTL_SECONDS: "60",
      DEEPGRAM_FLUX_MODEL: "flux-general-en",
      DEEPGRAM_FLUX_EOT_THRESHOLD: "0.7",
      DEEPGRAM_FLUX_EOT_TIMEOUT_MS: "5000"
    });

    expect(config.ttlSeconds).toBe(60);
    expect(config.eotThreshold).toBe(0.7);
    expect(config.eotTimeoutMs).toBe(5000);
  });

  it("requires the server-only API key", () => {
    expect(() => getDeepgramServerConfig({})).toThrow(DeepgramConfigError);
  });

  it("rejects invalid numeric values", () => {
    expect(() =>
      getDeepgramServerConfig({
        DEEPGRAM_API_KEY: "server-key",
        DEEPGRAM_FLUX_EOT_THRESHOLD: "0.2"
      })
    ).toThrow("DEEPGRAM_FLUX_EOT_THRESHOLD must be a number from 0.5 to 0.9");
  });

  it("rejects temporary token TTLs longer than 60 seconds", () => {
    expect(() =>
      getDeepgramServerConfig({
        DEEPGRAM_API_KEY: "server-key",
        DEEPGRAM_TEMP_TOKEN_TTL_SECONDS: "61"
      })
    ).toThrow("DEEPGRAM_TEMP_TOKEN_TTL_SECONDS must be a number from 1 to 60");
  });
});

describe("buildDeepgramFluxWebSocketUrl", () => {
  it("does not include raw-audio encoding parameters for containerized browser audio", () => {
    const url = buildDeepgramFluxWebSocketUrl({
      model: "flux-general-en",
      eotThreshold: 0.9,
      eotTimeoutMs: 10000
    });

    expect(url).not.toContain("encoding=");
    expect(url).not.toContain("sample_rate=");
  });
});
