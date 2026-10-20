// Reads and edits JSON and JSON with comments.
import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import type { Parsed } from '#cli/types/errors.ts';
import { GspotError, parseFileFields } from '#cli/system/errors.ts';
import type { EditableFile } from '#cli/types/parsers/editable-file.ts';
import { JSONC_OPTIONS, JSONC_EXTENSION } from '#cli/config/parsers/json.ts';
import { isRecord, getValueAt, normalizeTables } from '#cli/system/values.ts';
import { parse, modify, applyEdits, type ParseError, printParseErrorCode } from 'jsonc-parser';

// Parse the complete JSON document before editing or returning any of its fields.
export function parseJsonFile(path: string, source: string): Record<string, unknown>;
export function parseJsonFile<Value>(path: string, source: string, schema: z.ZodType<Value>): Value;
/**
 * Read a JSON object, and validate it against the schema, if any.
 *
 * @param path the repository-relative file.
 * @param source the file text.
 * @param schema the shape to check.
 * @returns the parsed object.
 */
export function parseJsonFile(path: string, source: string, schema?: z.ZodType): unknown {
    let value: unknown;
    try {
        value = path.endsWith(JSONC_EXTENSION) ? parseJsonc(source) : JSON.parse(source);
    } catch (error) {
        throw new GspotError('filesystem', `${path} is not valid JSON. Fix the file.`, { cause: error });
    }
    if (!isRecord(value)) throw new GspotError('filesystem', `${path} must contain a JSON object. Fix the file.`);
    return schema === undefined ? value : parseFileFields(path, value, schema);
}

/**
 * Parse and validate a source JSON document before a check reads its fields.
 *
 * @param text the JSON source.
 * @param schema the fields and constraints to validate.
 * @returns the validated value, or a parse error.
 */
export function parseJsonResult<T>(text: string, schema: z.ZodType<T>): Parsed<T> {
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
 * Open a JSON file to edit shared fields, and leave other content as written.
 *
 * @param path the file that syntax and edit errors name.
 * @param source the complete JSON or JSON-with-comments text.
 * @returns the editable document.
 */
export function openJsonFile(path: string, source: string): EditableFile {
    let text = source;
    let document = parseJsonFile(path, text);
    return {
        format: 'json',
        getValue: (keys) => normalizeTables(getValueAt(document, keys)),
        set(keys, value) {
            if (isDeepStrictEqual(normalizeTables(getValueAt(document, keys)), normalizeTables(value))) return;
            const next = applyEdits(text, modify(text, [...keys], value, {}));
            document = parseJsonFile(path, next);
            text = next;
        },
        getText: () => text,
    };
}

/**
 * Parse JSON with comments and trailing commas, and refuse partial results.
 *
 * @param text the source to parse.
 * @returns the parsed value.
 * @throws when the text does not parse.
 */
export function parseJsonc(text: string): unknown {
    const errors: ParseError[] = [];
    const value: unknown = parse(text, errors, JSONC_OPTIONS);
    const error = errors[0];
    if (error !== undefined)
        throw new SyntaxError(
            `Invalid JSON configuration at offset ${String(error.offset)}: ${printParseErrorCode(error.error)}.`,
        );
    return value;
}
