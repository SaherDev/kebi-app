import { z } from 'zod';

/**
 * Error thrown when a server response fails schema validation. Carries the
 * schema label and the flattened Zod issues so a screen can surface a useful
 * message and oncall can see exactly which field drifted. Mirrors `HttpError`
 * in ./transports/fetch.transport — a typed error the caller can categorise
 * without parsing strings.
 */
export class SchemaValidationError extends Error {
  constructor(
    public readonly label: string,
    public readonly issues: z.core.$ZodIssue[]
  ) {
    super(`Response validation failed for ${label}`);
    this.name = 'SchemaValidationError';
  }
}

/**
 * The validation boundary: parse an untrusted server payload through `schema`
 * and return the validated value (a class instance, since the response schemas
 * `.transform()` into model classes). Fail-closed — throws
 * {@link SchemaValidationError} on drift rather than letting an unexpected shape
 * reach components (ADR-041: contract-first, no silent fallback).
 *
 * @param label  short identifier for logs/errors, e.g. `"ChatResponse"`.
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new SchemaValidationError(label, result.error.issues);
  }
  return result.data;
}
