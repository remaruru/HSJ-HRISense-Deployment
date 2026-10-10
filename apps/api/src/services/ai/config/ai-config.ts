import { env } from '../../../config/env';

/**
 * AI Assistance configuration — the ONE place environment variables are read
 * for AI. Nothing here is ever sent to the browser except `AiAvailability`,
 * which carries no key material.
 *
 * Providers are selected by `AI_PROVIDER`. Adding a key for that provider is
 * the only step needed to switch the assistant on; `AI_ENABLED=false` switches
 * it off again without removing the key.
 */

export type AiProviderName = 'openai' | 'anthropic';

export interface AiConfig {
  enabled: boolean;
  provider: AiProviderName | null;
  /** The raw AI_PROVIDER value, for the "unknown provider" message. */
  providerSetting: string;
  model: string;
  apiKey: string | undefined;
  baseUrl: string | undefined;
  maxOutputTokens: number;
  maxToolRounds: number;
  timeoutMs: number;
  historyMessages: number;
  rateLimitPerHour: number;
  temperature: number | undefined;
}

export interface AiAvailability {
  /**
   * True only when AI is switched on AND a usable-looking key is present. This
   * reports CONFIGURATION, never reachability — no request is made to the
   * provider to decide it.
   */
  available: boolean;
  status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'DISABLED';
  reason?: string;
  provider?: string;
  model?: string;
}

let override: Partial<AiConfig> | null = null;

/** Test hook: replace parts of the configuration. Pass null to restore. */
export function setAiConfigOverrideForTests(partial: Partial<AiConfig> | null): void {
  override = partial;
}

function normaliseProvider(value: string): AiProviderName | null {
  const v = value.trim().toLowerCase();
  if (v === 'openai') return 'openai';
  if (v === 'anthropic' || v === 'claude') return 'anthropic';
  return null;
}

export function getAiConfig(): AiConfig {
  const provider = normaliseProvider(env.AI_PROVIDER);
  const base: AiConfig = {
    enabled: env.AI_ENABLED ?? true,
    provider,
    providerSetting: env.AI_PROVIDER,
    model: provider === 'anthropic' ? env.ANTHROPIC_MODEL : env.OPENAI_MODEL,
    apiKey: provider === 'anthropic' ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY,
    baseUrl: provider === 'anthropic' ? env.ANTHROPIC_BASE_URL : env.OPENAI_BASE_URL,
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    maxToolRounds: env.AI_MAX_TOOL_ROUNDS,
    timeoutMs: env.AI_REQUEST_TIMEOUT_MS,
    historyMessages: env.AI_HISTORY_MESSAGES,
    rateLimitPerHour: env.AI_RATE_LIMIT_PER_HOUR,
    temperature: env.AI_TEMPERATURE,
  };
  return override ? { ...base, ...override } : base;
}

/**
 * Placeholder values that ship in `.env.example` get copied into real `.env`
 * files. A key like `your-openai-api-key-here` is present but cannot work, and
 * reporting it as available would advertise AI on a server where every request
 * fails (BUG-014).
 */
export function looksLikeUsableKey(provider: AiProviderName, rawKey: string | undefined, hasCustomBaseUrl: boolean): boolean {
  const key = (rawKey ?? '').trim();
  if (!key) return false;
  if (/your|placeholder|changeme|xxx|<|>|api-key-here|\s/i.test(key)) return false;
  if (provider === 'anthropic') return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key);
  // A custom OpenAI-compatible endpoint may issue keys in its own format.
  if (hasCustomBaseUrl) return key.length >= 16;
  // OpenAI keys are `sk-` (or `sk-proj-`) followed by a long opaque secret.
  return /^sk-[A-Za-z0-9_-]{20,}$/.test(key);
}

const DATA_STILL_WORKS =
  'Everything else in HRISense — and the figures calculated directly from its records — keeps working.';

export function getAiAvailability(config: AiConfig = getAiConfig()): AiAvailability {
  if (!config.enabled) {
    return {
      available: false,
      status: 'DISABLED',
      reason: `AI Assistance has been switched off on this server (AI_ENABLED=false). ${DATA_STILL_WORKS}`,
    };
  }
  if (!config.provider) {
    return {
      available: false,
      status: 'NOT_CONFIGURED',
      reason: `AI Assistance is not configured: the AI provider setting is not recognised. ${DATA_STILL_WORKS}`,
    };
  }
  if (!looksLikeUsableKey(config.provider, config.apiKey, Boolean(config.baseUrl))) {
    return {
      available: false,
      status: 'NOT_CONFIGURED',
      reason: config.apiKey
        ? `AI Assistance is not configured on this server: the provider API key is a placeholder rather than a real key. ${DATA_STILL_WORKS}`
        : `AI Assistance is not configured on this server yet. An administrator needs to add an AI provider API key. ${DATA_STILL_WORKS}`,
    };
  }
  return { available: true, status: 'CONFIGURED', provider: config.provider, model: config.model };
}
