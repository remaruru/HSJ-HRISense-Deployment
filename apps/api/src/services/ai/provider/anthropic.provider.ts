import {
  AiProvider,
  AiProviderError,
  ChatMessage,
  CompletionRequest,
  CompletionResult,
  ToolCall,
} from './provider.types';

/**
 * Anthropic (Claude) via the Messages API over plain HTTPS, using tool use.
 * No SDK dependency: the request is small and fully typed here.
 */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';

  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl: string | undefined,
    private readonly timeoutMs: number
  ) {}

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const toolChoice =
      req.toolChoice === 'auto'
        ? { type: 'auto' }
        : req.toolChoice === 'required'
          ? { type: 'any' }
          : { type: 'tool', name: req.toolChoice.name };

    const body = {
      model: this.model,
      max_tokens: req.maxOutputTokens,
      system: req.system,
      messages: toAnthropicMessages(req.messages),
      tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      tool_choice: toolChoice,
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    };

    let response: Response;
    try {
      response = await fetch(`${(this.baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '')}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new AiProviderError('TIMEOUT', 'The AI provider did not answer in time.');
      throw new AiProviderError('UNAVAILABLE', `The AI provider could not be reached: ${String(err?.message ?? 'network error').slice(0, 200)}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // The error body is read for its message only; it never contains our key.
      let detail = '';
      try {
        const data: any = await response.json();
        detail = String(data?.error?.message ?? '').slice(0, 300);
      } catch {
        /* no JSON body */
      }
      if (response.status === 401 || response.status === 403) throw new AiProviderError('AUTH', 'The AI provider rejected the configured API key.');
      if (/credit balance|billing|quota/i.test(detail)) throw new AiProviderError('QUOTA', 'The AI provider account has no remaining credit or quota.');
      if (response.status === 429) throw new AiProviderError('RATE_LIMIT', 'The AI provider is rate-limiting requests.');
      if (response.status === 400) throw new AiProviderError('BAD_RESPONSE', `The AI provider refused the request (400): ${detail}`);
      throw new AiProviderError('UNAVAILABLE', `The AI provider returned ${response.status}. ${detail}`.trim());
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new AiProviderError('BAD_RESPONSE', 'The AI provider returned a response that could not be read.');
    }

    const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
    const text = blocks.filter((b) => b?.type === 'text').map((b) => String(b.text ?? '')).join('\n').trim();
    const toolCalls: ToolCall[] = blocks
      .filter((b) => b?.type === 'tool_use' && b.name)
      .map((b) => ({ id: String(b.id), name: String(b.name), arguments: JSON.stringify(b.input ?? {}) }));

    return {
      text: text || null,
      toolCalls,
      usage: {
        inputTokens: typeof data?.usage?.input_tokens === 'number' ? data.usage.input_tokens : null,
        outputTokens: typeof data?.usage?.output_tokens === 'number' ? data.usage.output_tokens : null,
      },
      model: String(data?.model ?? this.model),
      finishReason: data?.stop_reason ?? null,
    };
  }
}

/**
 * Anthropic requires strictly alternating user/assistant turns and carries tool
 * results inside a user turn. Consecutive tool results are grouped into one.
 */
export function toAnthropicMessages(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: any }> {
  const out: Array<{ role: 'user' | 'assistant'; content: any[] }> = [];
  const push = (role: 'user' | 'assistant', block: any) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(block);
    else out.push({ role, content: [block] });
  };

  for (const m of messages) {
    if (m.role === 'user') {
      push('user', { type: 'text', text: m.content });
    } else if (m.role === 'assistant') {
      if (m.content) push('assistant', { type: 'text', text: m.content });
      for (const tc of m.toolCalls ?? []) {
        let input: unknown = {};
        try {
          input = JSON.parse(tc.arguments || '{}');
        } catch {
          input = {};
        }
        push('assistant', { type: 'tool_use', id: tc.id, name: tc.name, input });
      }
    } else {
      push('user', { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content });
    }
  }
  // The conversation must open with a user turn.
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}
