import prettier from 'prettier';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

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
