import { parse, parseAllDocuments } from 'yaml';
import type { z } from 'zod';

import { MESSAGE_END } from '#cli/config/parsers.ts';
import { GspotError, parseFileFields } from '#cli/system/errors.ts';

export function parseYamlFile(path: string, text: string): unknown;

export function parseYamlFile<Value>(path: string, text: string, schema: z.ZodType<Value>): Value;

export function parseYamlFile(path: string, text: string, schema?: z.ZodType): unknown {
    let value: unknown;
    try {
        value = parse(text, { merge: true, logLevel: 'error' }) as unknown;
    } catch (error) {
        const syntaxError = error as Error;
        const detail = syntaxError.message.split('\n', 1).join('').replace(MESSAGE_END, '');
        throw new GspotError('parse', `${path} is not valid YAML: ${detail}. Fix the file.`, { cause: syntaxError });
    }
    return schema === undefined ? value : parseFileFields(path, value, schema);
}

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
