import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { matchItems } from '#tests/setup/matchers.ts';
import { generate } from '#cli/generation/generate.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import type { InitJson } from '#cli/types/commands/init.ts';
import { buildScopeTarget } from '#cli/repository/scopes.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runRegisteredCommand } from '#tests/setup/run-gspot.ts';

test('typos.toml keeps quoted words and paths and adds no settings', async () => {
    const words = ['café', "apostrophe'word", 'long-term'];
    const paths = ['docs/"draft"/**', 'generated/draft/**', 'café/**'];
    const reason = 'An upstream name.\n[files]\nextend-exclude = ["**"]';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: ['spelling'],
            allowed_words: { value: words, reason },
            ignore: [{ check: 'spelling/typos', paths, reason }],
        }),
    });
    const session = await openSession(sandbox.path);
    const output = generate(session);
    const target = output.files.find((file) => file.path === '.gspot/config/typos.toml');
    expect(target).toBeDefined();
    const parsed = parse(target!.content) as Record<string, unknown>;
    expect(Object.keys(parsed).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'default',
        'files',
        'type',
    ]);
    expect(parsed['type']).toStrictEqual({
        'gspot-settings': {
            'extend-glob': ['gspot.toml'],
            'extend-identifiers': {},
            'extend-words': {},
        },
    });
    expect(parsed['default']).toMatchObject({ 'extend-words': Object.fromEntries(words.map((word) => [word, word])) });
    expect(parsed['files']).toMatchObject({ 'extend-exclude': matchItems(paths) });
    expect(parsed['files']).not.toMatchObject({ 'extend-exclude': matchItems(['**']) });
});

test('a quoted word from a template reaches typos.toml through init', async () => {
    using _output = spyOn(process.stdout, 'write').mockReturnValue(true);

    const word = "café'upstream";
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'house.template.toml': stringify({
            configurations: ['spelling'],
            allowed_words: { value: [word], reason: 'An upstream name with # and "quotes".' },
        }),
    });
    const plan = await runRegisteredCommand(sandbox.path, [
        'init',
        '--yes',
        '--dry-run',
        '--from',
        'house.template.toml',
    ]);
    expect(plan.exitCode).toBe(0);
    const settings = (plan.json as InitJson)['settings'];
    if (typeof settings !== 'string') throw new Error('The initialization plan has no settings text.');
    await writeFile(join(sandbox.path, 'gspot.toml'), settings);
    const session = await openSession(sandbox.path);
    const output = generate(session);
    const target = output.files.find((file) => file.path === '.gspot/config/typos.toml');
    expect(target).toBeDefined();
    expect(parse(target!.content)).toMatchObject({ default: { 'extend-words': { [word]: word } } });
});

test('typos.toml selects the spelling locale of each scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'sample.md': '# Guide\n',
        'british/sample.md': '# Guide\n',
        'british/american/sample.md': '# Guide\n',
        'gspot.toml': buildSettingsText(['spelling'], {
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
        ({ target }) => target === '.gspot/config/typos.toml',
    )!;
    for (const [scope, locale] of [
        ['', 'en-us'],
        ['british', 'en-gb'],
        ['british/american', 'en-us'],
    ] as const) {
        const path = buildScopeTarget(scope, declaration, session.toolFiles().targets);
        const target = output.files.find((file) => file.path === path)!;
        expect(parse(target.content)).toHaveProperty('default.locale', locale);
    }
});
