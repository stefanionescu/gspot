import { z } from 'zod';
import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { safeParseJson } from '#cli/parsers/json.ts';
import { parse } from '@formatjs/icu-messageformat-parser';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { MESSAGE_FILE_SUFFIX } from '#cli/config/checks/library.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

// Every message of a file by its dotted key: a nested table adds its key to the path of what it holds.
function flattenMessages(value: unknown, prefix = ''): Map<string, string> {
    if (value === null || typeof value !== 'object') return new Map();
    const pairs = Object.entries(value).flatMap(([key, entry]): [string, string][] => {
        const name = prefix === '' ? key : `${prefix}.${key}`;
        return typeof entry === 'string' ? [[name, entry]] : flattenMessages(entry, name).entries().toArray();
    });
    return new Map(pairs);
}

function translationMessage(text: string): string | undefined {
    if (text.trim() === '') return 'The message is empty.';
    try {
        parse(text);
        return undefined;
    } catch (error) {
        return `The message does not parse: ${error instanceof Error ? error.message : 'a syntax error'}.`;
    }
}

/**
 * The findings of the message files under the folder the settings name.
 * @param input the check input.
 * @returns the findings.
 */
function translationsMessages(input: CheckInput): Finding[] {
    const options = input.scope.view.options('translations');
    const directory = options.messages_folder as string;
    const base = options.base_locale;
    const files = input.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${directory}/`) && path.endsWith(MESSAGE_FILE_SUFFIX));
    const messagesByPath = new Map<string, Map<string, string>>();
    const findings: Finding[] = [];
    for (const path of files) {
        const parsed = safeParseJson(readCachedBytes(input.reads, path).toString('utf8'), messagesSchema);
        if ('error' in parsed) findings.push(findingAt(input, { file: path, line: 1 }, 'syntax', parsed.error));
        else messagesByPath.set(path, flattenMessages(parsed.value));
    }
    if (findings.length > 0) return findings;
    const baseline = [...messagesByPath].find(([path]) => posix.basename(path) === `${base}${MESSAGE_FILE_SUFFIX}`);
    if (baseline === undefined)
        return [
            findingAt(
                input,
                { file: posix.join(directory, `${base}${MESSAGE_FILE_SUFFIX}`), line: 1 },
                'base-locale',
                `The base locale ${base}${MESSAGE_FILE_SUFFIX} is missing from ${directory}. Restore it or choose the intended base locale.`,
            ),
        ];
    const baseMessages = baseline[1];
    return messagesByPath
        .entries()
        .flatMap(([path, messages]) => {
            const broken = [...messages].flatMap(([key, text]) => {
                const message = translationMessage(text);
                return message === undefined
                    ? []
                    : [findingAt(input, { file: path, line: 1 }, 'message', `${key}: ${message}`)];
            });
            const missing = baseMessages
                .keys()
                .filter((key) => !messages.has(key))
                .map((key) =>
                    findingAt(
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

export { translationsMessages };
