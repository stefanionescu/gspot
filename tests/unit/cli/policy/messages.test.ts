import * as messages from '#cli/policy/messages.ts';
import { expect, test } from 'bun:test';

// A message speaks of a setting, a configuration, a scope, and a default; these are names of the code, not of the reader.
const INTERNAL_WORDS = /\b(?:expose[sd]?|surface|layer|spec|schema)\b/iu;

const SAMPLE_ARGUMENTS: Record<string, unknown[]> = {
    conflictingScalars: ['tools.sqlfluff.dialect', 'sql', 'postgres'],
    settingNotExposed: ['tools.shellcheck.severity', ['tools.shellcheck.rules']],
    settingInScope: ['tools.jest.coverage_lines', 'api'],
};

// A message takes names and lists; the first shape that the function accepts is the sample.
function sampleText(name: string, message: Message): string | undefined {
    const known = SAMPLE_ARGUMENTS[name];
    const shapes: (() => unknown)[] = [() => 'tools.example.setting', () => ['tools.example.setting', 'api']];
    const attempts: unknown[][] =
        known === undefined ? shapes.map((shape) => Array.from({ length: message.length }, () => shape())) : [known];
    for (const attempt of attempts) {
        try {
            const text = message(...attempt);
            if (typeof text === 'string') return text;
        } catch {
            continue;
        }
    }
    return undefined;
}

type Message = (...arguments_: unknown[]) => unknown;

const functions = Object.entries(messages)
    .filter(([, value]) => typeof value === 'function')
    .map(([name, value]) => [name, value as unknown as Message] as const);

test('every message function speaks in the words of the config, never in the names of the code', () => {
    const offending = functions.flatMap(([name, message]) => {
        const text = sampleText(name, message);
        return text !== undefined && INTERNAL_WORDS.test(text) ? [`${name}: ${text}`] : [];
    });
    expect(offending).toStrictEqual([]);
    expect(functions.length).toBeGreaterThan(20);
});

test('an unknown setting names the setting the reader wrote and where to see every one', () => {
    const text = messages.settingNotExposed('tools.shellcheck.severity', ['tools.shellcheck.rules']);
    expect(text).toContain('No selected configuration has the setting `tools.shellcheck.severity`.');
    expect(text).toContain('`tools.shellcheck.rules`');
    expect(text).toContain('gspot list settings');
});
