import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { getPosition } from '#cli/system/text.ts';
import { JSONC_OPTIONS } from '#cli/config/parsers/formats/json.ts';
import { GspotError, parseFileFields } from '#cli/system/errors.ts';
import type { EditableFile } from '#cli/types/parsers/editable-file.ts';
import { isTable, getValueAt, normalizeTables } from '#cli/system/tables.ts';
import { parse, modify, applyEdits, type ParseError, printParseErrorCode } from 'jsonc-parser';

export function parseJsonFile(path: string, text: string): Record<string, unknown>;

export function parseJsonFile<Value>(path: string, text: string, schema: z.ZodType<Value>): Value;

/**
Read a JSON object, and validate it against the schema, if any.

@param path the repository-relative file.
@param text the complete JSON source, including comments.
@param schema the shape to check.
@returns the parsed object.
*/
export function parseJsonFile(path: string, text: string, schema?: z.ZodType): unknown {
    const errors: ParseError[] = [];
    const value: unknown = parse(text, errors, JSONC_OPTIONS);
    const error = errors[0];
    if (error !== undefined) {
        const { line, column } = getPosition(text, error.offset);
        throw new GspotError(
            'filesystem',
            `${path}:${String(line)}:${String(column)} is not valid JSON: ${printParseErrorCode(error.error)}. Fix the file.`,
        );
    }
    if (!isTable(value)) throw new GspotError('filesystem', `${path} must contain a JSON object. Fix the file.`);
    return schema === undefined ? value : parseFileFields(path, value, schema);
}

/**
Open a JSON file to edit shared fields, and leave other content as written.

@param path the file that syntax and edit errors name.
@param text the complete JSON or JSON-with-comments text.
@returns the editable document.
*/
export function openJsonFile(path: string, text: string): EditableFile {
    let editedText = text;
    let document = parseJsonFile(path, editedText);
    return {
        getValue: (keys) => normalizeTables(getValueAt(document, keys)),
        set(keys, value) {
            if (isDeepStrictEqual(normalizeTables(getValueAt(document, keys)), normalizeTables(value))) return;
            const next = applyEdits(editedText, modify(editedText, [...keys], value, {}));
            document = parseJsonFile(path, next);
            editedText = next;
        },
        getText: () => editedText,
    };
}

export function parseToolReport(tool: string, text: string): unknown;

export function parseToolReport<Value>(tool: string, text: string, schema: z.ZodType<Value>): Value;

/**
Parse and validate a report, and keep its untrusted contents out of errors.

@param tool the program that printed the report.
@param text the JSON report.
@param schema the shape to validate when supplied.
@returns the parsed report, with any requested validation.
*/
export function parseToolReport(tool: string, text: string, schema?: z.ZodType): unknown {
    try {
        const parsed: unknown = JSON.parse(text);
        return schema === undefined ? parsed : schema.parse(parsed);
    } catch {
        throw new GspotError('output', `${tool} printed output that gspot cannot read.`);
    }
}
