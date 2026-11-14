import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/system/errors.ts';
import type { EditableFile } from '#cli/types/parsers.ts';
import { getPosition } from '#cli/system/text/positions.ts';
import { parseFileFields } from '#cli/parsers/validation.ts';
import { JSONC_OPTIONS } from '#cli/config/parsers/formats.ts';
import { isTable, findValueAt, normalizeTables } from '#cli/system/tables.ts';
import { parse, modify, applyEdits, type ParseError, printParseErrorCode } from 'jsonc-parser/lib/esm/main.js';

export function parseJsonFile(path: string, text: string): Record<string, unknown>;

export function parseJsonFile<Value>(path: string, text: string, schema: z.ZodType<Value>): Value;

export function parseJsonFile(path: string, text: string, schema?: z.ZodType): unknown {
    const errors: ParseError[] = [];
    const offset = text.startsWith('\u{FEFF}') ? 1 : 0;
    const value: unknown = parse(text.slice(offset), errors, JSONC_OPTIONS);
    const error = errors[0];
    if (error !== undefined) {
        const { line, column } = getPosition(text, error.offset + offset);
        throw new GspotError(
            'parse',
            `${path}:${String(line)}:${String(column)} is not valid JSON: ${printParseErrorCode(error.error)}. Fix the file.`,
        );
    }
    if (!isTable(value)) throw new GspotError('parse', `${path} must contain a JSON object. Fix the file.`);
    return schema === undefined ? value : parseFileFields(path, value, schema);
}

export function openJsonFile(path: string, text: string): EditableFile {
    let editedText = text;
    let document = parseJsonFile(path, editedText);
    return {
        getValue: (keys) => normalizeTables(findValueAt(document, keys)),
        set(keys, value) {
            if (isDeepStrictEqual(normalizeTables(findValueAt(document, keys)), normalizeTables(value))) return;
            const offset = editedText.startsWith('\u{FEFF}') ? 1 : 0;
            const source = editedText.slice(offset);
            const next = editedText.slice(0, offset) + applyEdits(source, modify(source, [...keys], value, {}));
            document = parseJsonFile(path, next);
            editedText = next;
        },
        getText: () => editedText,
    };
}
