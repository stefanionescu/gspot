import type { z } from 'zod';
import { GspotError } from '#cli/system/errors.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { MESSAGE_END } from '#cli/config/parsers/formats.ts';
import { parseFileFields } from '#cli/parsers/validation.ts';

export function parseTomlFile(path: string, text: string): Record<string, unknown>;

export function parseTomlFile<Value>(path: string, text: string, schema: z.ZodType<Value>): Value;

export function parseTomlFile(path: string, text: string, schema?: z.ZodType): unknown {
    let value: Record<string, unknown>;
    try {
        value = parseToml(text) as Record<string, unknown>;
    } catch (error) {
        const issue = error as Error;
        const position =
            'line' in issue && typeof issue.line === 'number' && 'column' in issue && typeof issue.column === 'number'
                ? `${path}:${String(issue.line)}:${String(issue.column + 1)}`
                : path;
        const detail = issue.message.trimEnd().split('\n').slice(-1).join('').replace(MESSAGE_END, '');
        throw new GspotError('parse', `${position} is not valid TOML: ${detail}. Fix the file.`, {
            cause: issue,
        });
    }
    return schema === undefined ? value : parseFileFields(path, value, schema);
}
