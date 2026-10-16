// Reads and edits JSON and JSON with comments.
import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import type { Parsed } from '#cli/types/errors.ts';
import type { EditableFile } from '#cli/types/parsers/editable-file.ts';
import { JSONC_OPTIONS, JSONC_EXTENSION } from '#cli/config/parsers/json.ts';
import { isRecord, getValueAt, normalizeTables } from '#cli/system/values.ts';
import { parse, modify, applyEdits, type ParseError, printParseErrorCode } from 'jsonc-parser';

// Parse the complete JSON document before editing or returning any of its fields.
export function readJson(path: string, source: string): Record<string, unknown>;
export function readJson<Value>(path: string, source: string, schema: z.ZodType<Value>): Value;
/**
 * Read a JSON object. Validate its shape against any supplied schema.
 * @param path the repository-relative file path.
 * @param source the file text.
 * @param schema the schema for parsed-value validation.
 * @returns the parsed JSON object, checked against the supplied schema.
 */
export function readJson(path: string, source: string, schema?: z.ZodType): unknown {
    try {
        const value: unknown = path.endsWith(JSONC_EXTENSION) ? parseJsonc(source) : JSON.parse(source);
        if (!isRecord(value)) throw new Error('JSON configuration must contain an object.');
        return schema === undefined ? value : schema.parse(value);
    } catch (error) {
        throw new Error(`${path} is not valid JSON. Fix the file, then run gspot apply.`, { cause: error });
    }
}

/**
 * Parse and validate a source JSON document before a check reads its fields.
 * @param text the JSON source.
 * @param schema the fields and constraints to validate.
 * @returns the validated value or a source diagnostic.
 */
export function parseJsonDocument<T>(text: string, schema: z.ZodType<T>): Parsed<T> {
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        return { error: error.message };
    }
    const parsed = schema.safeParse(value);
    return parsed.success ? { value: parsed.data } : { error: parsed.error.message };
}

/**
 * Reads and edits shared JSON fields without rewriting unrelated content.
 * @param path the destination used in syntax and edit errors.
 * @param source the complete JSON or JSON-with-comments text.
 * @returns the document used by managed field edits.
 */
export function openJsonFile(path: string, source: string): EditableFile {
    let text = source;
    let document = readJson(path, text);
    return {
        format: 'json',
        value: (keys) => normalizeTables(getValueAt(document, keys)),
        set(keys, value) {
            if (isDeepStrictEqual(normalizeTables(getValueAt(document, keys)), normalizeTables(value))) return;
            const next = applyEdits(text, modify(text, [...keys], value, {}));
            document = readJson(path, next);
            text = next;
        },
        text: () => text,
    };
}

/**
 * Parses configuration JSON with comments and trailing commas, rejecting partial results.
 * @param text the configuration text.
 * @returns the parsed configuration.
 * @throws when the text does not parse.
 */
export function parseJsonc(text: string): unknown {
    const errors: ParseError[] = [];
    const value: unknown = parse(text, errors, JSONC_OPTIONS);
    const error = errors[0];
    if (error !== undefined)
        throw new Error(
            `Invalid JSON configuration at offset ${String(error.offset)}: ${printParseErrorCode(error.error)}.`,
        );
    return value;
}
