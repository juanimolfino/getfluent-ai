const DEFAULT_TEMP_TOKEN_TTL_SECONDS = 30;
const MAX_TEMP_TOKEN_TTL_SECONDS = 60;
const DEFAULT_FLUX_MODEL = "flux-general-en";
const DEFAULT_EOT_THRESHOLD = 0.9;
const DEFAULT_EOT_TIMEOUT_MS = 10000;

export const DEEPGRAM_TOKEN_GRANT_URL = "https://api.deepgram.com/v1/auth/grant";
export const DEEPGRAM_FLUX_PROVIDER = "deepgram_flux";

export type DeepgramServerConfig = {
  apiKey: string;
  ttlSeconds: number;
  model: string;
  eotThreshold: number;
  eotTimeoutMs: number;
  websocketUrl: string;
};

export type DeepgramConfigErrorCode = "missing_api_key" | "invalid_env";

export class DeepgramConfigError extends Error {
  code: DeepgramConfigErrorCode;

  constructor(code: DeepgramConfigErrorCode, message: string) {
    super(message);
    this.name = "DeepgramConfigError";
    this.code = code;
  }
}

function parseNumberInRange(options: {
  name: string;
  value: string | undefined;
  defaultValue: number;
  min: number;
  max: number;
}) {
  if (!options.value) return options.defaultValue;
  const parsed = Number(options.value);
  if (!Number.isFinite(parsed) || parsed < options.min || parsed > options.max) {
    throw new DeepgramConfigError(
      "invalid_env",
      `${options.name} must be a number from ${options.min} to ${options.max}`
    );
  }
  return parsed;
}

export function buildDeepgramFluxWebSocketUrl(config: {
  model: string;
  eotThreshold: number;
  eotTimeoutMs: number;
}) {
  const params = new URLSearchParams({
    model: config.model,
    eot_threshold: String(config.eotThreshold),
    eot_timeout_ms: String(config.eotTimeoutMs)
  });

  return `wss://api.deepgram.com/v2/listen?${params.toString()}`;
}

export function getDeepgramServerConfig(env: Partial<Record<string, string | undefined>> = process.env): DeepgramServerConfig {
  const apiKey = env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) {
    throw new DeepgramConfigError("missing_api_key", "DEEPGRAM_API_KEY is required");
  }

	  const ttlSeconds = parseNumberInRange({
	    name: "DEEPGRAM_TEMP_TOKEN_TTL_SECONDS",
	    value: env.DEEPGRAM_TEMP_TOKEN_TTL_SECONDS,
	    defaultValue: DEFAULT_TEMP_TOKEN_TTL_SECONDS,
	    min: 1,
	    max: MAX_TEMP_TOKEN_TTL_SECONDS
	  });
  const eotThreshold = parseNumberInRange({
    name: "DEEPGRAM_FLUX_EOT_THRESHOLD",
    value: env.DEEPGRAM_FLUX_EOT_THRESHOLD,
    defaultValue: DEFAULT_EOT_THRESHOLD,
    min: 0.5,
    max: 0.9
  });
  const eotTimeoutMs = parseNumberInRange({
    name: "DEEPGRAM_FLUX_EOT_TIMEOUT_MS",
    value: env.DEEPGRAM_FLUX_EOT_TIMEOUT_MS,
    defaultValue: DEFAULT_EOT_TIMEOUT_MS,
    min: 500,
    max: 10000
  });
  const model = env.DEEPGRAM_FLUX_MODEL?.trim() || DEFAULT_FLUX_MODEL;

  return {
    apiKey,
    ttlSeconds,
    model,
    eotThreshold,
    eotTimeoutMs,
    websocketUrl: buildDeepgramFluxWebSocketUrl({ model, eotThreshold, eotTimeoutMs })
  };
}
