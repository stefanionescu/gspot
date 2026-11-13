import { LineCounter, parse, parseAllDocuments } from 'yaml';
import type { z } from 'zod';

import { MESSAGE_END, YAML_OPTIONS, YAML_POSITION_OPTIONS } from '#cli/config/parsers/formats.ts';
import { parseFileFields } from '#cli/parsers/validation.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { PositionedYaml } from '#cli/types/parsers.ts';

export function parseYamlFile(path: string, text: string): unknown;

export function parseYamlFile<Value>(path: string, text: string, schema: z.ZodType<Value>): Value;

export function parseYamlFile(path: string, text: string, schema?: z.ZodType): unknown {
    let value: unknown;
    try {
        value = parse(text, YAML_OPTIONS) as unknown;
    } catch (error) {
        const syntaxError = error as Error;
        const detail = syntaxError.message.split('\n', 1).join('').replace(MESSAGE_END, '');
        throw new GspotError('parse', `${path} is not valid YAML: ${detail}. Fix the file.`, { cause: syntaxError });
    }
    return schema === undefined ? value : parseFileFields(path, value, schema);
}

export function parseYamlDocuments(path: string, text: string): unknown[] {
    const documents = parseAllDocuments(text, YAML_OPTIONS);
    return documents.map((document) => {
        const error = document.errors[0];
        if (error !== undefined)
            throw new GspotError('parse', `${path} is not valid YAML: ${error.message}. Fix the file.`, {
                cause: error,
            });
        return document.toJS() as unknown;
    });
}

/**
Parse every document of a YAML text and keep its line starts. The documents keep their syntax errors, and
`findPosition` gives the line and column of an offset, or of the start of the text when a node has no range.
*/
export function parseYamlPositions(text: string): PositionedYaml {
    const lines = new LineCounter();
    const documents = parseAllDocuments(text, { ...YAML_POSITION_OPTIONS, lineCounter: lines });
    return { documents, findPosition: (offset = 0) => lines.linePos(offset) };
}
