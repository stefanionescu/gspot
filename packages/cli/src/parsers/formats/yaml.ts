import { parse } from 'yaml';
import type { z } from 'zod';
import { GspotError, parseFileFields } from '#cli/system/errors.ts';

export function parseYamlFile(path: string, text: string): unknown;
export function parseYamlFile<Value>(path: string, text: string, schema: z.ZodType<Value>): Value;
/**
Parse YAML, and name the file on invalid syntax or fields.

@param path the source file.
@param text the YAML contents.
@param schema the fields to validate, when supplied.
@returns the parsed value.
*/
export function parseYamlFile(path: string, text: string, schema?: z.ZodType): unknown {
    let value: unknown;
    try {
        value = parse(text, { merge: true }) as unknown;
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        const detail = error.message.split('\n', 1).join('').replace(/[.:]$/u, '');
        throw new GspotError('filesystem', `${path} is not valid YAML: ${detail}. Fix the file.`, { cause: error });
    }
    return schema === undefined ? value : parseFileFields(path, value, schema);
}
