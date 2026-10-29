import type { z } from 'zod';
import { parse, parseAllDocuments } from 'yaml';
import { MESSAGE_END } from '#cli/config/parsers/formats/errors.ts';
import { GspotError, parseFileFields } from '#cli/system/errors.ts';

export function parseYamlFile(path: string, text: string): unknown;

export function parseYamlFile<Value>(path: string, text: string, schema: z.ZodType<Value>): Value;

/**
Parse YAML, and name the file on invalid syntax or fields.

@param path the source file.
@param text the YAML contents.
@param schema the fields to validate, when supplied.
*/
export function parseYamlFile(path: string, text: string, schema?: z.ZodType): unknown {
    let value: unknown;
    try {
        value = parse(text, { merge: true, logLevel: 'error' }) as unknown;
    } catch (error_) {
        const error = error_ as Error;
        const detail = error.message.split('\n', 1).join('').replace(MESSAGE_END, '');
        throw new GspotError('parse', `${path} is not valid YAML: ${detail}. Fix the file.`, { cause: error });
    }
    return schema === undefined ? value : parseFileFields(path, value, schema);
}

/**
Parse every document of a YAML file.

@param path the file, for the error.
@param text the complete source, including document separators.
@returns the value of each document, in order.
*/
export function parseYamlDocuments(path: string, text: string): unknown[] {
    const documents = parseAllDocuments(text, { merge: true, logLevel: 'error' });
    return documents.map((document) => {
        const error = document.errors[0];
        if (error !== undefined)
            throw new GspotError('parse', `${path} is not valid YAML: ${error.message}. Fix the file.`, {
                cause: error,
            });
        return document.toJS() as unknown;
    });
}
