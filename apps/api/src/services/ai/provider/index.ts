import { getAiAvailability, getAiConfig } from '../config/ai-config';
import { AnthropicProvider } from './anthropic.provider';
import { OpenAiProvider } from './openai.provider';
import type { AiProvider } from './provider.types';

export * from './provider.types';

let testProvider: AiProvider | null = null;

/**
 * Test hook: route every AI call to a scripted provider. Used by the
 * adversarial tests so they exercise the real orchestrator, tools and
 * authorization without a network or a key.
 */
export function setAiProviderForTests(provider: AiProvider | null): void {
  testProvider = provider;
}

/** The configured provider, or null when AI is not available. */
export function getAiProvider(): AiProvider | null {
  if (testProvider) return testProvider;
  const config = getAiConfig();
  if (!getAiAvailability(config).available || !config.apiKey || !config.provider) return null;
  if (config.provider === 'anthropic') {
    return new AnthropicProvider(config.model, config.apiKey, config.baseUrl, config.timeoutMs);
  }
  return new OpenAiProvider(config.model, config.apiKey, config.baseUrl, config.timeoutMs);
}

/** True when a scripted test provider is installed (availability then ignores keys). */
export function hasTestProvider(): boolean {
  return testProvider !== null;
}
