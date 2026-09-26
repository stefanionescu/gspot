import prettier from 'prettier';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';
import { evaluateFormat } from '#cli/evaluation/format.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

test('Prettier adoption preserves override selectors for new files', async () => {
    await using directory = await testdir();
    const source = {
        semi: false,
        tabWidth: 4,
        overrides: [{ files: 'src/**/*.js', excludeFiles: 'src/vendor/**', options: { tabWidth: 8 } }],
    };
    await createFileTree(directory.path, { '.prettierrc.json': JSON.stringify(source), 'source.js': 'const value=1' });
    const carried = await evaluateFormat({
        root: directory.path,
        from: '.prettierrc.json',
        source,
    });
    expect(carried.extra?.['overrides']).toStrictEqual(source.overrides);
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            configurations: ['formatting'],
            format: carried.format,
            tools: { prettier: { extra: carried.extra } },
        }),
    );
    const renderSession1 = await openSession(directory.path);
    const generated = emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
        version: renderSession1.version,
        packageManager: renderSession1.packageManager,
    }).files.find((file) => file.path === '.gspot/config/prettier.json')!;
    mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
    writeFileSync(join(directory.path, generated.path), generated.content);
    const options = await prettier.resolveConfig(join(directory.path, 'src/future.js'), {
        config: join(directory.path, generated.path),
    });
    expect(options).toMatchObject({ tabWidth: 8, semi: false });
    const excluded = await prettier.resolveConfig(join(directory.path, 'src/vendor/future.js'), {
        config: join(directory.path, generated.path),
    });
    expect(excluded).toMatchObject({ tabWidth: 4, semi: false });
});

test('nested Prettier configurations reset parent options and preserve ordered future-file selectors', async () => {
    await using directory = await testdir();
    const configs = {
        '.prettierrc.json': JSON.stringify({
            semi: false,
            singleQuote: true,
            overrides: [{ files: '**/*.js', options: { tabWidth: 8 } }],
        }),
        'src/.prettierrc.json5':
            "{ // Native defaults reset the parent\n bracketSpacing: false, overrides: [{ files: '*.js', excludeFiles: 'vendor/**', options: { tabWidth: 4 } }], }",
        'src/deep/prettier.config.mjs': 'export default { semi: false, printWidth: 30 };',
    };
    await createFileTree(directory.path, configs);
    const carried = await collectCarried(
        directory.path,
        {
            configs: Object.keys(configs).map((path) => ({ tool: 'prettier', path, carries: 'rules-table' as const })),
            hooks: [],
            ci: [],
            agentFiles: [],
            rulesDirectories: [],
            lintFolders: [],
            lintOnlyManifests: [],
            runner: 'none',
        },
        new Set(['formatting']),
        [],
    );
    expect(carried.unread).toStrictEqual([]);
    expect(carried.removed.map(({ path }) => path)).toStrictEqual(Object.keys(configs));
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            configurations: ['formatting'],
            format: carried.formatter?.format,
            tools: { prettier: { extra: carried.formatter?.extra } },
        }),
    );
    const renderSession2 = await openSession(directory.path);
    const generated = emitAll(renderSession2.policyFiles.policy, renderSession2.repository, renderSession2.scopes, {
        version: renderSession2.version,
        packageManager: renderSession2.packageManager,
    }).files.find((file) => file.path === '.gspot/config/prettier.json')!;
    mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
    writeFileSync(join(directory.path, generated.path), generated.content);
    const text = 'function example() { return { first: "one", second: "two", third: "three" }; }';
    for (const path of [
        'future.js',
        'src/future.js',
        'src/vendor/future.js',
        'src/deep/future.js',
        'src/deep/more/future.js',
    ]) {
        const filepath = join(directory.path, path);
        const before = await prettier.resolveConfig(filepath, { useCache: false });
        const after = await prettier.resolveConfig(filepath, {
            config: join(directory.path, generated.path),
            useCache: false,
        });
        expect(await prettier.format(text, { ...after, filepath }), path).toBe(
            await prettier.format(text, { ...before, filepath }),
        );
    }
    for (const [path, original] of Object.entries(configs))
        expect(readFileSync(join(directory.path, path), 'utf8')).toBe(original);
});

test.each([
    ['future.jsx', 'const node = <Item first="one" second="two" />;\n'],
    ['nested/future.js', 'const value = {\n first: "one", second: "two"\n};\n'],
    ['future.html', '<div first="one" second="two"><span> text </span></div>\n'],
    ['future.md', 'A paragraph with enough words to wrap across several lines under a narrow width.\n'],
])('Prettier adoption preserves native layout options for %s created later', async (path, text) => {
    await using directory = await testdir();
    const source = {
        bracketSpacing: false,
        bracketSameLine: true,
        singleAttributePerLine: true,
        jsxSingleQuote: true,
        quoteProps: 'consistent' as const,
        objectWrap: 'collapse' as const,
        htmlWhitespaceSensitivity: 'strict' as const,
        proseWrap: 'always' as const,
        printWidth: 30,
        endOfLine: 'auto' as const,
        overrides: [{ files: '*.js', options: { tabWidth: 0, printWidth: 12 } }],
    };
    await createFileTree(directory.path, { '.prettierrc.json': JSON.stringify(source) });
    const filepath = join(directory.path, path);
    const previous = await prettier.resolveConfig(filepath, { useCache: false });
    const expected = await prettier.format(text, { ...previous, filepath });
    const carried = await evaluateFormat({ root: directory.path, from: '.prettierrc.json', source });
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            configurations: ['formatting'],
            format: carried.format,
            tools: { prettier: { extra: carried.extra } },
        }),
    );
    const renderSession3 = await openSession(directory.path);
    const generated = emitAll(renderSession3.policyFiles.policy, renderSession3.repository, renderSession3.scopes, {
        version: renderSession3.version,
        packageManager: renderSession3.packageManager,
    }).files.find((file) => file.path === '.gspot/config/prettier.json')!;
    mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
    writeFileSync(join(directory.path, generated.path), generated.content);
    const current = await prettier.resolveConfig(filepath, {
        config: join(directory.path, generated.path),
        useCache: false,
    });
    expect(await prettier.format(text, { ...current, filepath })).toBe(expected);
});

test('Prettier adoption preserves ordered ignore negations for files created later', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        '.prettierrc.json': '{"semi":false}',
        '.prettierignore': 'src/*\n!src/keep.js\n',
    });
    const carried = await collectCarried(
        directory.path,
        {
            configs: [
                { tool: 'prettier', path: '.prettierrc.json', carries: 'rules-table' as const },
                { tool: 'prettier', path: '.prettierignore', carries: 'ignore-paths' },
            ],
            hooks: [],
            ci: [],
            agentFiles: [],
            rulesDirectories: [],
            lintFolders: [],
            lintOnlyManifests: [],
            runner: 'none',
        },
        new Set(['formatting']),
        [],
    );
    expect(carried.unread).toStrictEqual([]);
    expect(carried.removed.map(({ path }) => path)).toStrictEqual(['.prettierrc.json', '.prettierignore']);
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            configurations: ['formatting'],
            format: carried.formatter!.format,
            tools: { prettier: { ignore_patterns: carried.formatter!.ignorePatterns } },
        }),
    );
    const renderSession4 = await openSession(directory.path);
    const generated = emitAll(renderSession4.policyFiles.policy, renderSession4.repository, renderSession4.scopes, {
        version: renderSession4.version,
        packageManager: renderSession4.packageManager,
        takeover: carried.observed,
    }).files.find(({ path }) => path === '.prettierignore')!;
    writeFileSync(join(directory.path, '.prettierignore'), generated.content);
    expect(
        (
            await prettier.getFileInfo(join(directory.path, 'src/future.js'), {
                ignorePath: join(directory.path, '.prettierignore'),
            })
        ).ignored,
    ).toBe(true);
    expect(
        (
            await prettier.getFileInfo(join(directory.path, 'src/keep.js'), {
                ignorePath: join(directory.path, '.prettierignore'),
            })
        ).ignored,
    ).toBe(false);
});
