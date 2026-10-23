import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findManifestTarget, findConfigFilePath } from '#tests/setup/cli/generated-files.ts';
import { BRITISH_SCOPE_SETTINGS } from '#tests/config/generation/configurations/general/spelling.ts';

test('typos.toml lists each allowed word once and keeps quoted paths', async () => {
    const words = ['café', "apostrophe'word", 'long-term'];
    const paths = ['docs/"draft"/**', 'generated/draft/**', 'café/**'];
    const reason = 'An upstream name.\n[files]\nextend-exclude = ["**"]';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['spelling'], {
            rules: true,
            tables: stringify({
                spelling: { allowed_words: Object.fromEntries(words.map((word) => [word, reason])) },
                ignore: [{ check: 'spelling/typos', paths, reason }],
            }),
        }),
    });

    const session = await openSession(sandbox.path);
    const output = generate(session);
    const target = output.files.find((file) => file.path === findManifestTarget('spelling', 'typos.toml'))!;
    const parsed = parse(target.content) as Record<string, unknown>;
    expect(Object.keys(parsed).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'default',
        'files',
    ]);
    expect(parsed).not.toHaveProperty('type');
    expect(parsed['default']).not.toHaveProperty('extend-identifiers');
    expect(parsed['default']).toMatchObject({ 'extend-words': Object.fromEntries(words.map((word) => [word, word])) });
    const { 'extend-exclude': excluded, ...otherFiles } = parsed['files'] as { 'extend-exclude': string[] };
    expect(otherFiles).toStrictEqual({});
    expect(excluded.slice(-paths.length)).toStrictEqual(paths);
    expect(excluded).not.toContain('**');
});

test('typos.toml selects the spelling locale of each scope', async () => {
    await using sandbox = await testdir({
        'sample.md': '# Guide\n',
        'british/sample.md': '# Guide\n',
        'british/american/sample.md': '# Guide\n',
        'gspot.toml': buildSandboxSettings(['spelling'], BRITISH_SCOPE_SETTINGS),
    });

    const session = await openSession(sandbox.path);
    const output = generate(session);
    for (const [scope, locale] of [
        ['', 'en'],
        ['british', 'en-gb'],
        ['british/american', 'en-us'],
    ] as const) {
        const path = findConfigFilePath(session, 'typos', scope);
        const target = output.files.find((file) => file.path === path)!;
        expect(parse(target.content)).toHaveProperty('default.locale', locale);
    }
});
