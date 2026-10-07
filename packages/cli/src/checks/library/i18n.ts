import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/source.ts';
import { parse } from '@formatjs/icu-messageformat-parser';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { LocaleSettings } from '#cli/types/checks/library/i18n.ts';

// Every message of a file by its dotted key: a nested table adds its key to the path of what it holds.
function flattenMessages(value: unknown, prefix = ''): Map<string, string> {
    if (value === null || typeof value !== 'object') return new Map();
    const pairs = Object.entries(value).flatMap(([key, entry]): [string, string][] => {
        const name = prefix === '' ? key : `${prefix}.${key}`;
        return typeof entry === 'string' ? [[name, entry]] : flattenMessages(entry, name).entries().toArray();
    });
    return new Map(pairs);
}

// The keys that hold a dot: a dot is how a nested key is written, so one inside a key names two places.
function dottedKeys(value: unknown): string[] {
    if (value === null || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, entry]) => [...(key.includes('.') ? [key] : []), ...dottedKeys(entry)]);
}

function translationProblem(text: string): string | undefined {
    if (text.trim() === '') return 'The message is empty.';
    try {
        parse(text);
        return undefined;
    } catch (error) {
        return `The message does not parse: ${error instanceof Error ? error.message : 'a syntax error'}.`;
    }
}

/**
 * The findings of the message files under the folder the policy names. With no folder named the check passes.
 * @param input the check input
 * @returns the findings
 */
export function locales(input: CheckInput): Finding[] {
    const setting = input.view.options('i18n')['locales'] as LocaleSettings | undefined;
    if (setting?.directory === undefined) return [];
    const directory = posix.join(input.scope, setting.directory);
    const base = setting.base ?? 'en';
    const files = input.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${directory}/`) && path.endsWith('.json'));
    const raw = new Map(
        files.map((path) => [path, JSON.parse(readSource(input.root, path, input.reads).toString('utf8')) as unknown]),
    );
    const messagesByPath = new Map([...raw].map(([path, value]) => [path, flattenMessages(value)]));
    const baseline = [...messagesByPath].find(([path]) => posix.basename(path) === `${base}.json`);
    if (baseline === undefined)
        return [
            findingAt(
                input,
                { file: posix.join(directory, `${base}.json`), line: 1 },
                'base-locale',
                `The base locale ${base}.json is missing from ${directory}. Restore it or choose the intended base locale.`,
            ),
        ];
    const baseMessages = baseline[1];
    return messagesByPath
        .entries()
        .flatMap(([path, messages]) => {
            const broken = [...messages].flatMap(([key, text]) => {
                const problem = translationProblem(text);
                return problem === undefined
                    ? []
                    : [findingAt(input, { file: path, line: 1 }, 'message', `${key}: ${problem}`)];
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
            const dotted = dottedKeys(raw.get(path)).map((key) =>
                findingAt(
                    input,
                    { file: path, line: 1 },
                    'dotted-key',
                    `The key ${key} holds a dot, which is how a nested key is written.`,
                ),
            );
            return [...broken, ...missing, ...dotted];
        })
        .toArray();
}
