// Message files: every one parses as ICU MessageFormat, none is empty, and every locale holds every key of the base.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import type { Translations } from '#types/web.ts';
import { parse } from '@formatjs/icu-messageformat-parser';

// Every message of a file by its dotted key: a nested table adds its key to the path of what it holds.
function flat(value: unknown, prefix = ''): Map<string, string> {
    if (value === null || typeof value !== 'object') return new Map();
    const pairs = Object.entries(value).flatMap(([key, entry]): [string, string][] => {
        const name = prefix === '' ? key : `${prefix}.${key}`;
        return typeof entry === 'string' ? [[name, entry]] : flat(entry, name).entries().toArray();
    });
    return new Map(pairs);
}

// The keys that hold a dot: a dot is how a nested key is written, so one inside a key names two places.
function dottedKeys(value: unknown): string[] {
    if (value === null || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, entry]) => [...(key.includes('.') ? [key] : []), ...dottedKeys(entry)]);
}

function textProblem(text: string): string | undefined {
    if (text.trim() === '') return 'The message is empty.';
    try {
        parse(text);
        return undefined;
    } catch (error) {
        return `The message does not parse: ${error instanceof Error ? error.message : 'a syntax error'}.`;
    }
}

function translations(input: EngineInput): Translations | undefined {
    const named = input.view.tool('i18n')['translations'] as Translations | undefined;
    return named?.directory === undefined ? undefined : named;
}

/**
 * The findings of the message files under the folder the policy names. With no folder named the check passes.
 * @param input the engine input
 * @returns the findings
 */
export function localeFiles(input: EngineInput): Promise<Finding[]> {
    const named = translations(input);
    if (named === undefined) return Promise.resolve([]);
    const base = named.base ?? 'en';
    const files = input.session.repository.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${named.directory ?? ''}/`) && path.endsWith('.json'));
    const raw = new Map(
        files.map((path) => [path, JSON.parse(readFileSync(join(input.root, path), 'utf8')) as unknown]),
    );
    const held = new Map([...raw].map(([path, value]) => [path, flat(value)]));
    const basePath = files.find((path) => path.slice(path.lastIndexOf('/') + 1) === `${base}.json`);
    const wanted =
        basePath === undefined ? new Map<string, string>() : (held.get(basePath) ?? new Map<string, string>());
    const at = (file: string, rule: string, text: string): Finding => ({
        check: input.spec.name,
        file,
        line: 1,
        rule,
        message: text,
        fixable: false,
    });
    const found = held
        .entries()
        .flatMap(([path, messages]) => {
            const broken = [...messages].flatMap(([key, text]) => {
                const problem = textProblem(text);
                return problem === undefined ? [] : [at(path, 'message', `${key}: ${problem}`)];
            });
            const missing = wanted
                .keys()
                .filter((key) => !messages.has(key))
                .map((key) => at(path, 'missing-key', `The key ${key} of ${base} has no message here.`))
                .toArray();
            const dotted = dottedKeys(raw.get(path)).map((key) =>
                at(path, 'dotted-key', `The key ${key} holds a dot, which is how a nested key is written.`),
            );
            return [...broken, ...missing, ...dotted];
        })
        .toArray();
    return Promise.resolve(found);
}
