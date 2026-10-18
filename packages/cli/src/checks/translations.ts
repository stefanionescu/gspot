import { z } from 'zod';
import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { parseJsonResult } from '#cli/parsers/json.ts';
import { parse } from '@formatjs/icu-messageformat-parser';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';
import { MESSAGE_FILE_SUFFIX } from '#cli/config/checks/translations.ts';

// Every message of a file by its dotted key: a nested table adds its key to the path of what it holds.
function flattenMessages(value: unknown, prefix = ''): Map<string, string> {
    if (value === null || typeof value !== 'object') return new Map();
    const pairs = Object.entries(value).flatMap(([key, entry]): [string, string][] => {
        const name = prefix === '' ? key : `${prefix}.${key}`;
        return typeof entry === 'string' ? [[name, entry]] : flattenMessages(entry, name).entries().toArray();
    });
    return new Map(pairs);
}

function validateMessage(text: string): string | undefined {
    if (text.trim() === '') return 'The message is empty.';
    try {
        parse(text);
        return undefined;
    } catch (error) {
        return `The message does not parse: ${error instanceof Error ? error.message : 'a syntax error'}.`;
    }
}

/**
 * Checks the message files in `translations.messages_folder` against the base locale.
 * @param input the scope files and translation settings.
 * @returns the findings.
 */
function checkTranslationMessages(input: CheckInput): Finding[] {
    const options = input.selection.view.options('translations');
    const folder = options.messages_folder as string;
    const base = options.base_locale;
    const files = input.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${folder}/`) && path.endsWith(MESSAGE_FILE_SUFFIX));
    const messagesByPath = new Map<string, Map<string, string>>();
    const findings: Finding[] = [];
    for (const path of files) {
        const parsed = parseJsonResult(readCachedBytes(input.reads, path).toString('utf8'), messagesSchema);
        if ('error' in parsed) findings.push(buildFinding(input, { file: path, line: 1 }, 'syntax', parsed.error));
        else messagesByPath.set(path, flattenMessages(parsed.value));
    }
    if (findings.length > 0) return findings;
    const baseline = [...messagesByPath].find(([path]) => posix.basename(path) === `${base}${MESSAGE_FILE_SUFFIX}`);
    if (baseline === undefined)
        return [
            buildFinding(
                input,
                { file: posix.join(folder, `${base}${MESSAGE_FILE_SUFFIX}`), line: 1 },
                'base-locale',
                `The base locale ${base}${MESSAGE_FILE_SUFFIX} is missing from ${folder}. Restore it or choose the intended base locale.`,
            ),
        ];
    const baseMessages = baseline[1];
    return messagesByPath
        .entries()
        .flatMap(([path, messages]) => {
            const broken = [...messages].flatMap(([key, text]) => {
                const message = validateMessage(text);
                return message === undefined
                    ? []
                    : [buildFinding(input, { file: path, line: 1 }, 'message', `${key}: ${message}`)];
            });
            const missing = baseMessages
                .keys()
                .filter((key) => !messages.has(key))
                .map((key) =>
                    buildFinding(
                        input,
                        { file: path, line: 1 },
                        'missing-key',
                        `The key ${key} of ${base} has no message here.`,
                    ),
                )
                .toArray();
            return [...broken, ...missing];
        })
        .toArray();
}

const messagesSchema = z.record(z.string(), z.unknown()) satisfies z.ZodType<Record<string, unknown>>;

export { checkTranslationMessages };
