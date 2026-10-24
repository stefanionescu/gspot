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
    const observed = {
        rules: true,
        tables: stringify({
            spelling: { allowed_words: Object.fromEntries(words.map((word) => [word, reason])) },
            ignore: [{ check: 'spelling/typos', paths, reason }],
        }),
    };
    const settingsText = {
        'gspot.toml': buildSandboxSettings(['spelling'], observed),
    };
    await using sandbox = await testdir(settingsText);

    const session = await openSession(sandbox.path);
    const output = generate(session);
    const target = output.files.find((file) => file.path === findManifestTarget('spelling', 'typos.toml'))!;
    const parsed = parse(target.content) as Record<string, unknown>;
    expect(parsed['default']).toStrictEqual({
        locale: 'en',
        'extend-ignore-re': [String.raw`\b[0-9a-f]{7,40}\b`, String.raw`\b[A-Za-z0-9+/]{40,}={0,2}\b`],
        'extend-words': { café: 'café', "apostrophe'word": "apostrophe'word", 'long-term': 'long-term' },
    });
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
