import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { parse, stringify } from 'smol-toml';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { buildInitOptions } from '#tests/setup/init.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { containingAll } from '#tests/setup/matchers.ts';
import { targetInScope } from '#cli/repository/scopes.ts';
import { initCommand } from '#cli/commands/init/command.ts';

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
    const output = emitAll(session);
    const target = output.files.find((file) => file.path === '.gspot/config/typos.toml');
    expect(target).toBeDefined();
    const parsed = parse(target!.content);
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
    expect(parsed['files']).toMatchObject({ 'extend-exclude': containingAll(paths) });
    expect(parsed['files']).not.toMatchObject({ 'extend-exclude': containingAll(['**']) });
});

test('a quoted word from a template reaches typos.toml through init', async () => {
    const word = "café'upstream";
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'house.template.toml': stringify({
            configurations: ['spelling'],
            allowed_words: { value: [word], reason: 'An upstream name with # and "quotes".' },
        }),
    });
    const plan = await initCommand(
        buildInitOptions(sandbox.path, {
            from: 'house.template.toml',
            isDryRun: true,
        }),
    );
    expect(plan.exitCode).toBe(0);
    const settings = plan.json['settings'];
    if (typeof settings !== 'string') throw new Error('The initialization plan has no settings text.');
    await writeFile(join(sandbox.path, 'gspot.toml'), settings);
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const target = output.files.find((file) => file.path === '.gspot/config/typos.toml');
    expect(target).toBeDefined();
    expect(parse(target!.content)['default']).toMatchObject({ 'extend-words': { [word]: word } });
});

test('typos.toml selects the spelling locale of each scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'sample.md': '# Guide\n',
        'british/sample.md': '# Guide\n',
        'british/american/sample.md': '# Guide\n',
        'gspot.toml': settingsText(['spelling'], {
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
    const output = emitAll(session);
    const paths = new Set(output.files.map(({ path }) => path));
    const declaration = session.scopes[0]!.selected.flatMap(({ toolFiles }) => toolFiles).find(
        ({ target }) => target === '.gspot/config/typos.toml',
    )!;
    for (const [scope, locale] of [
        ['', 'en-us'],
        ['british', 'en-gb'],
        ['british/american', 'en-us'],
    ] as const) {
        const path = targetInScope(scope, declaration, paths);
        const target = output.files.find((file) => file.path === path)!;
        expect(parse(target.content)['default']).toMatchObject({ locale });
    }
});
