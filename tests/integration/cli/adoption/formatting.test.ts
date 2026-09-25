import prettier from 'prettier';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { emitAll } from '#cli/generation/targets.ts';
import { openSession } from '#cli/execution/session.ts';
import { createFileTree, testdir } from 'testdirs';
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

test('shared EditorConfig selectors govern files created after generation', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["formatting"]\n[[format.overrides]]\npaths = ["tests/**/*.js"]\nindent_width = 6\n',
        'source.js': 'const value=1;',
    });
    const session = await openSession(directory.path);
    const editor = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    }).files.find(({ path }) => path === '.editorconfig')!;
    writeFileSync(join(directory.path, editor.path), editor.content);
    expect(
        await prettier.resolveConfig(join(directory.path, 'tests/future.js'), { editorconfig: true, useCache: false }),
    ).toMatchObject({ tabWidth: 6 });
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        'version = 1\nconfigurations = ["formatting"]\n[[format.overrides]]\npaths = ["tests/**", "!tests/vendor/**"]\nindent_width = 6\n',
    );
    const unsupported = await openSession(directory.path);
    expect(() =>
        emitAll(unsupported.policyFiles.policy, unsupported.repository, unsupported.scopes, {
            version: unsupported.version,
            packageManager: unsupported.packageManager,
        }),
    ).toThrow('EditorConfig cannot represent selector "!tests/vendor/**"');
    expect(readFileSync(join(directory.path, editor.path), 'utf8')).toBe(editor.content);
});

test('nested EditorConfig adoption preserves root boundaries and unset for future files', async () => {
    await using directory = await testdir();
    const configs = {
        '.editorconfig': 'root = true\n[*]\nindent_style = space\nindent_size = 8\nmax_line_length = 90\n',
        'nested/.editorconfig': '[*.js]\nindent_size = 3\nmax_line_length = unset\n',
        'isolated/.editorconfig': 'root = true\n[*]\nindent_style = tab\nindent_size = 5\n',
    };
    await createFileTree(directory.path, configs);
    const paths = ['future.js', 'nested/future.js', 'nested/deep/future.js', 'isolated/future.js'];
    const before = await Promise.all(
        paths.map((path) =>
            prettier.resolveConfig(join(directory.path, path), { editorconfig: true, useCache: false }),
        ),
    );
    const carried = await collectCarried(
        directory.path,
        {
            configs: Object.keys(configs).map((path) => ({ tool: 'ec', path, carries: 'rules-table' as const })),
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
    expect(carried.removed.map((entry) => entry.path)).toStrictEqual(Object.keys(configs));
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            configurations: ['formatting'],
            tools: { editorconfig: { adopted: carried.formatter?.editorconfig }, prettier: { native_defaults: true } },
        }),
    );
    const renderSession5 = await openSession(directory.path);
    const generated = emitAll(renderSession5.policyFiles.policy, renderSession5.repository, renderSession5.scopes, {
        version: renderSession5.version,
        packageManager: renderSession5.packageManager,
        takeover: carried.observed,
    });
    const editors = generated.files.filter((file) => file.path.endsWith('.editorconfig'));
    expect(editors.map((file) => file.path).sort()).toStrictEqual(Object.keys(configs).sort());
    for (const file of editors) writeFileSync(join(directory.path, file.path), file.content);
    const after = await Promise.all(
        paths.map((path) =>
            prettier.resolveConfig(join(directory.path, path), { editorconfig: true, useCache: false }),
        ),
    );
    expect(after).toStrictEqual(before);
    expect(after[1]).toMatchObject({ tabWidth: 3 });
    expect(after[3]).toMatchObject({ tabWidth: 5, useTabs: true });
});

test('combined formatter adoption preserves EditorConfig precedence and nested parser resets', async () => {
    await using directory = await testdir();
    const configs = {
        '.editorconfig': 'root = true\n[*]\nindent_style = space\nindent_size = 8\n',
        'nested/.editorconfig': '[*]\nindent_size = 3\n',
        '.prettierrc.json': JSON.stringify({
            parser: 'babel',
            tabWidth: 10,
            semi: false,
            overrides: [{ files: '*.js', options: { singleQuote: true } }],
        }),
        'nested/.prettierrc.json': JSON.stringify({
            bracketSpacing: false,
            overrides: [{ files: '*.js', excludeFiles: 'vendor/**', options: { semi: false } }],
        }),
    };
    await createFileTree(directory.path, configs);
    const cases = [
        ['future.js', 'function sample(){return {text:"example"};}'],
        ['nested/future.js', 'function sample(){return {text:"example"};}'],
        ['nested/vendor/future.js', 'function sample(){return {text:"example"};}'],
        ['nested/future.html', '<section><div><span>Text</span></div></section>'],
    ] as const;
    const before = await Promise.all(
        cases.map(async ([path, text]) => {
            const filepath = join(directory.path, path);
            return prettier.format(text, {
                ...(await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false })),
                filepath,
            });
        }),
    );
    const carried = await collectCarried(
        directory.path,
        {
            configs: Object.keys(configs).map((path) => ({
                tool: path.endsWith('.editorconfig') ? 'ec' : 'prettier',
                carries: 'rules-table' as const,
                path,
            })),
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
    expect(carried.formatter?.nativeDefaults).toBe(true);
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            configurations: ['formatting'],
            format: carried.formatter?.format,
            tools: {
                prettier: { native_defaults: carried.formatter?.nativeDefaults, extra: carried.formatter?.extra },
                editorconfig: { adopted: carried.formatter?.editorconfig },
            },
        }),
    );
    const renderSession6 = await openSession(directory.path);
    const generated = emitAll(renderSession6.policyFiles.policy, renderSession6.repository, renderSession6.scopes, {
        version: renderSession6.version,
        packageManager: renderSession6.packageManager,
        takeover: carried.observed,
    });
    for (const file of generated.files.filter(
        (file) => file.path.endsWith('.editorconfig') || file.path === '.gspot/config/prettier.json',
    )) {
        mkdirSync(join(directory.path, file.path, '..'), { recursive: true });
        writeFileSync(join(directory.path, file.path), file.content);
    }
    for (const [index, [path, text]] of cases.entries()) {
        const filepath = join(directory.path, path);
        const options = await prettier.resolveConfig(filepath, {
            config: join(directory.path, '.gspot/config/prettier.json'),
            editorconfig: true,
            useCache: false,
        });
        expect(await prettier.format(text, { ...options, filepath }), path).toBe(before[index]!);
    }
});
