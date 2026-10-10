/**
 * Provider-neutral chat types. The orchestrator speaks only these; each adapter
 * translates them to its vendor's wire format. Swapping providers therefore
 * never touches authorization, tools, policy or auditing.
 */

/** A JSON Schema object, as produced by `zodToJsonSchema`. */
export type JsonSchema = Record<string, unknown>;

export interface ToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  /** Raw JSON text exactly as the model produced it. Validated before use. */
  arguments: string;
}

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export type ToolChoice = 'auto' | 'required' | { name: string };

export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  tools: ToolSpec[];
  toolChoice: ToolChoice;
  maxOutputTokens: number;
  temperature?: number;
}

export interface CompletionResult {
  text: string | null;
  toolCalls: ToolCall[];
  usage: { inputTokens: number | null; outputTokens: number | null };
  model: string;
  finishReason: string | null;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

/** QUOTA = the provider account has no credit or quota left (billing, not load). */
export type AiProviderErrorKind = 'AUTH' | 'QUOTA' | 'RATE_LIMIT' | 'TIMEOUT' | 'UNAVAILABLE' | 'BAD_RESPONSE';

/**
 * A provider failure with the vendor detail stripped. `message` is safe to log:
 * adapters never put request bodies, headers or keys into it.
 */
export class AiProviderError extends Error {
  constructor(public readonly kind: AiProviderErrorKind, message: string) {
    super(message);
    this.name = 'AiProviderError';
  }
}
