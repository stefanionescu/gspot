import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { modify, applyEdits } from 'jsonc-parser';
import { parseJsonc } from '#cli/parsers/jsonc.ts';
import type { JsonDocument } from '#cli/types/parsers/json.ts';
import type { ConfigurationDocument } from '#cli/types/parsers/document.ts';
import { valueAt, isRecord, normalizeTables } from '#cli/platform/objects.ts';

// Parse the complete native JSON document before editing or returning any of its fields.
function readSharedJson(path: string, source: string): Record<string, unknown> {
    try {
        const value: unknown = path.endsWith('.jsonc') ? parseJsonc(source) : JSON.parse(source);
        if (!isRecord(value)) throw new Error('JSON configuration must contain an object.');
        return value;
    } catch (error) {
        throw new Error(`${path} is not valid JSON. Fix the file, then run gspot apply.`, { cause: error });
    }
}

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

/**
 * Reads and edits shared JSON fields without rewriting unrelated authored content.
 * @param path the destination used in syntax and edit errors
 * @param source the complete JSON or JSON-with-comments text
 * @returns the document used by managed field edits
 */
export function openJsonDocument(path: string, source: string): ConfigurationDocument {
    let text = source;
    let document = readSharedJson(path, text);
    return {
        format: 'json',
        value: (keys) => normalizeTables(valueAt(document, keys)),
        set(keys, value) {
            if (isDeepStrictEqual(normalizeTables(valueAt(document, keys)), normalizeTables(value))) return;
            try {
                const next = applyEdits(text, modify(text, keys, value, {}));
                document = readSharedJson(path, next);
                text = next;
            } catch (error) {
                throw new Error(`${path} cannot be edited at ${keys.join('.')}. Fix the field, then run gspot apply.`, {
                    cause: error,
                });
            }
        },
        text: () => text,
    };
}
