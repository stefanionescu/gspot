import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { matchItems } from '#tests/setup/matchers.ts';
import { generate } from '#cli/generation/generate.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { buildScopeTarget } from '#cli/repository/scopes.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { getToolFiles } from '#cli/generation/settings/generate.ts';

test('typos.toml lists each allowed word once and keeps quoted paths', async () => {
    const words = ['café', "apostrophe'word", 'long-term'];
    const paths = ['docs/"draft"/**', 'generated/draft/**', 'café/**'];
    const reason = 'An upstream name.\n[files]\nextend-exclude = ["**"]';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['spelling'], {
            rules: true,
            tables: stringify({
                allowed_words: Object.fromEntries(words.map((word) => [word, reason])),
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
        'gspot.toml': buildSandboxSettings(['spelling'], {
            level: 'all',
            tables: `[[scope]]
path = "british"
spelling.locale = "en-gb"
[[scope]]
path = "british/american"
spelling.locale = "en-us"
`,
        }),
    });

    const session = await openSession(sandbox.path);
    const output = generate(session);
    const declaration = session.scopes[0]!.selected.flatMap(({ toolFiles }) => toolFiles).find(
        ({ target }) => target === '.gspot/configurations/general/spelling/typos.toml',
    )!;
    for (const [scope, locale] of [
        ['', 'en'],
        ['british', 'en-gb'],
        ['british/american', 'en-us'],
    ] as const) {
        const path = buildScopeTarget(scope, declaration, getToolFiles(session).targets);
        const target = output.files.find((file) => file.path === path)!;
        expect(parse(target.content)).toHaveProperty('default.locale', locale);
    }
});
