import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { matchItems } from '#tests/setup/matchers.ts';
import { generate } from '#cli/generation/generate.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findConfigFilePath } from '#tests/setup/cli/config-files.ts';
import { BRITISH_SCOPE_SETTINGS } from '#tests/data/generation/config-files/builders/typos.ts';

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
    const target = output.files.find((file) => file.path === '.gspot/configurations/general/spelling/typos.toml');
    expect(target).toBeDefined();
    const parsed = parse(target!.content) as Record<string, unknown>;
    expect(Object.keys(parsed).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'default',
        'files',
    ]);
    expect(parsed).not.toHaveProperty('type');
    expect(parsed['default']).not.toHaveProperty('extend-identifiers');
    expect(parsed['default']).toMatchObject({ 'extend-words': Object.fromEntries(words.map((word) => [word, word])) });
    expect(parsed['files']).toMatchObject({ 'extend-exclude': matchItems(paths) });
    expect(parsed['files']).not.toMatchObject({ 'extend-exclude': matchItems(['**']) });
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
