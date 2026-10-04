import type { z } from 'zod';
import { isRecord } from '#cli/platform/objects.ts';
import type { JsonDocument } from '#cli/types/parsers/json.ts';

/**
 * Parse and validate a source JSON document before a check reads its fields.
 * @param text the authored JSON source
 * @param schema the fields and constraints consumed by its owner
 * @returns the validated value or a source diagnostic
 */
export function parseJsonDocument<T>(text: string, schema: z.ZodType<T>): JsonDocument<T> {
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        return { error: error.message };
    }
    const parsed = schema.safeParse(value);
    return parsed.success ? { data: parsed.data } : { error: parsed.error.message };
}

/**
 * Read a strict JSON config file whose consumers require named fields.
 * @param text the JSON source
 * @returns its object fields without narrowing their tool-specific values
 */
export function parseJsonRecord(text: string): Record<string, unknown> {
    const value: unknown = JSON.parse(text);
    if (!isRecord(value)) throw new Error('JSON configuration must contain an object.');
    return value;
}
