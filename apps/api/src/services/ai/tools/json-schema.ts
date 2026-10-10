import { z } from 'zod';
import type { JsonSchema } from '../provider/provider.types';

/**
 * Converts the small subset of zod used for tool arguments into JSON Schema,
 * so each tool's argument contract is written ONCE (in zod) and the schema
 * sent to the model can never drift from the schema the server enforces.
 *
 * Unsupported zod types throw at startup rather than silently producing a
 * permissive schema.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  const def: any = (schema as any)._def;
  const description: string | undefined = def.description;
  const withDescription = (s: JsonSchema): JsonSchema => (description ? { ...s, description } : s);

  switch (def.typeName) {
    case 'ZodObject': {
      const shape = (schema as z.ZodObject<any>).shape;
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        const child = value as z.ZodTypeAny;
        properties[key] = zodToJsonSchema(child);
        if (!child.isOptional()) required.push(key);
      }
      return withDescription({
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: false,
      });
    }
    case 'ZodString': {
      const out: JsonSchema = { type: 'string' };
      for (const check of def.checks ?? []) {
        if (check.kind === 'min') out.minLength = check.value;
        if (check.kind === 'max') out.maxLength = check.value;
        if (check.kind === 'uuid') out.format = 'uuid';
        if (check.kind === 'regex') out.pattern = check.regex.source;
      }
      return withDescription(out);
    }
    case 'ZodNumber': {
      const isInt = (def.checks ?? []).some((c: any) => c.kind === 'int');
      const out: JsonSchema = { type: isInt ? 'integer' : 'number' };
      for (const check of def.checks ?? []) {
        if (check.kind === 'min') out.minimum = check.value;
        if (check.kind === 'max') out.maximum = check.value;
      }
      return withDescription(out);
    }
    case 'ZodBoolean':
      return withDescription({ type: 'boolean' });
    case 'ZodEnum':
      return withDescription({ type: 'string', enum: [...def.values] });
    case 'ZodArray': {
      const out: JsonSchema = { type: 'array', items: zodToJsonSchema(def.type) };
      if (def.minLength) out.minItems = def.minLength.value;
      if (def.maxLength) out.maxItems = def.maxLength.value;
      return withDescription(out);
    }
    case 'ZodOptional':
    case 'ZodDefault': {
      const inner = zodToJsonSchema(def.innerType);
      return description ? { ...inner, description } : inner;
    }
    case 'ZodNullable': {
      const inner = zodToJsonSchema(def.innerType);
      return withDescription({ anyOf: [inner, { type: 'null' }] });
    }
    case 'ZodEffects':
      return zodToJsonSchema(def.schema);
    default:
      throw new Error(`zodToJsonSchema: unsupported zod type ${def.typeName}`);
  }
}
