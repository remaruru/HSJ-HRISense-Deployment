import type OpenAI from 'openai';
import {
  AiProvider,
  AiProviderError,
  CompletionRequest,
  CompletionResult,
  ToolCall,
} from './provider.types';

/**
 * OpenAI (and OpenAI-compatible endpoints) via the official SDK, using function
 * calling. The SDK is imported lazily so a server without AI never loads it.
 */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private client: OpenAI | null = null;

  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl: string | undefined,
    private readonly timeoutMs: number
  ) {}

  private async getClient(): Promise<OpenAI> {
    if (!this.client) {
      const { default: OpenAIClient } = await import('openai');
      this.client = new OpenAIClient({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
        timeout: this.timeoutMs,
        maxRetries: 1,
      });
    }
    return this.client;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const client = await this.getClient();

    const messages: any[] = [{ role: 'system', content: req.system }];
    for (const m of req.messages) {
      if (m.role === 'user') messages.push({ role: 'user', content: m.content });
      else if (m.role === 'assistant') {
        messages.push({
          role: 'assistant',
          content: m.content ?? '',
          ...(m.toolCalls?.length
            ? {
                tool_calls: m.toolCalls.map((tc) => ({
                  id: tc.id,
                  type: 'function',
                  function: { name: tc.name, arguments: tc.arguments },
                })),
              }
            : {}),
        });
      } else {
        messages.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
      }
    }

    const toolChoice =
      req.toolChoice === 'auto' || req.toolChoice === 'required'
        ? req.toolChoice
        : { type: 'function', function: { name: req.toolChoice.name } };

    try {
      const completion = await client.chat.completions.create({
        model: this.model,
        messages,
        tools: req.tools.map((t) => ({
          type: 'function' as const,
          function: { name: t.name, description: t.description, parameters: t.parameters as any },
        })),
        tool_choice: toolChoice as any,
        // Custom endpoints generally still expect the older parameter name.
        ...(this.baseUrl ? { max_tokens: req.maxOutputTokens } : { max_completion_tokens: req.maxOutputTokens }),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      });

      const choice = completion.choices?.[0];
      if (!choice) throw new AiProviderError('BAD_RESPONSE', 'The AI provider returned no answer.');

      const toolCalls: ToolCall[] = (choice.message.tool_calls ?? [])
        .filter((tc: any) => tc.type === 'function' && tc.function?.name)
        .map((tc: any) => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments ?? '{}' }));

      return {
        text: choice.message.content ?? null,
        toolCalls,
        usage: {
          inputTokens: completion.usage?.prompt_tokens ?? null,
          outputTokens: completion.usage?.completion_tokens ?? null,
        },
        model: completion.model ?? this.model,
        finishReason: choice.finish_reason ?? null,
      };
    } catch (err: any) {
      throw mapOpenAiError(err);
    }
  }
}

export function mapOpenAiError(err: any): AiProviderError {
  if (err instanceof AiProviderError) return err;
  const status = Number(err?.status);
  const name = String(err?.name ?? '');
  if (status === 401 || status === 403) return new AiProviderError('AUTH', 'The AI provider rejected the configured API key.');
  // OpenAI answers 429 both when busy and when the account has no credit left.
  const code = String(err?.code ?? err?.error?.code ?? '');
  const type = String(err?.type ?? err?.error?.type ?? '');
  if (status === 429 && (type === 'insufficient_quota' || code === 'insufficient_quota' || /credit|quota|billing/i.test(code))) {
    return new AiProviderError('QUOTA', 'The AI provider account has no remaining credit or quota.');
  }
  if (status === 429) return new AiProviderError('RATE_LIMIT', 'The AI provider is rate-limiting requests.');
  if (/timeout/i.test(name) || /timed out/i.test(String(err?.message))) {
    return new AiProviderError('TIMEOUT', 'The AI provider did not answer in time.');
  }
  if (status === 400) return new AiProviderError('BAD_RESPONSE', `The AI provider refused the request (400): ${String(err?.message ?? '').slice(0, 300)}`);
  return new AiProviderError('UNAVAILABLE', `The AI provider could not be reached: ${String(err?.message ?? 'unknown error').slice(0, 300)}`);
}
