import prettier from 'prettier';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { collectKept } from '#cli/policy/adoption/collect.ts';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

test('shared EditorConfig selectors govern files created after generation', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml':
            'version = 1\nkits = ["formatting"]\n[[format.overrides]]\npaths = ["tests/**/*.js"]\nindent_width = 6\n',
        'source.js': 'const value=1;',
    });
    const session = await openSession(directory.path);
    const editor = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.find(({ path }) => path === '.editorconfig')!;
    writeFileSync(join(directory.path, editor.path), editor.content);
    expect(
        await prettier.resolveConfig(join(directory.path, 'tests/future.js'), { editorconfig: true, useCache: false }),
    ).toMatchObject({ tabWidth: 6 });
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        'version = 1\nkits = ["formatting"]\n[[format.overrides]]\npaths = ["tests/**", "!tests/vendor/**"]\nindent_width = 6\n',
    );
    const unsupported = await openSession(directory.path);
    expect(() =>
        emitAll(unsupported.policyFiles.policy, unsupported.repository, unsupported.scopes, {
            version: unsupported.version,
            packageClient: unsupported.packageClient,
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
    const kept = await collectKept(
        directory.path,
        {
            configs: Object.keys(configs).map((path) => ({ tool: 'ec', path, keeps: 'rules-table' as const })),
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
    expect(kept.unread).toStrictEqual([]);
    expect(kept.removed.map((entry) => entry.path)).toStrictEqual(Object.keys(configs));
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            kits: ['formatting'],
            tools: { editorconfig: { adopted: kept.formatter?.editorconfig }, prettier: { native_defaults: true } },
        }),
    );
    const session = await openSession(directory.path);
    const generated = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
        replace: kept.observed,
    });
    const editors = generated.files.filter((file) => file.path.endsWith('.editorconfig'));
    expect(editors.map((file) => file.path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        Object.keys(configs).toSorted((left, right) => left.localeCompare(right)),
    );
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

const FORMATTER_CONFIGS = {
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
const PRECEDENCE_CASES = [
    ['future.js', 'function sample(){return {text:"example"};}'],
    ['nested/future.js', 'function sample(){return {text:"example"};}'],
    ['nested/vendor/future.js', 'function sample(){return {text:"example"};}'],
    ['nested/future.html', '<section><div><span>Text</span></div></section>'],
] as const;
test.each(PRECEDENCE_CASES)(
    'combined formatter adoption preserves precedence and parser resets for %s',
    async (path, text) => {
        await using directory = await testdir();
        await createFileTree(directory.path, FORMATTER_CONFIGS);
        const filepath = join(directory.path, path);
        const before = await prettier.format(text, {
            ...(await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false })),
            filepath,
        });
        const kept = await collectKept(
            directory.path,
            {
                configs: Object.keys(FORMATTER_CONFIGS).map((path) => ({
                    tool: path.endsWith('.editorconfig') ? 'ec' : 'prettier',
                    keeps: 'rules-table' as const,
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
        expect(kept.unread).toStrictEqual([]);
        expect(kept.formatter?.nativeDefaults).toBe(true);
        writeFileSync(
            join(directory.path, 'gspot.toml'),
            stringify({
                version: 1,
                kits: ['formatting'],
                format: kept.formatter?.format,
                tools: {
                    prettier: { native_defaults: kept.formatter?.nativeDefaults, extra: kept.formatter?.extra },
                    editorconfig: { adopted: kept.formatter?.editorconfig },
                },
            }),
        );
        const session = await openSession(directory.path);
        const generated = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageClient: session.packageClient,
            replace: kept.observed,
        });
        for (const file of generated.files.filter(
            (file) => file.path.endsWith('.editorconfig') || file.path === '.gspot/config/prettier.json',
        )) {
            mkdirSync(join(directory.path, file.path, '..'), { recursive: true });
            writeFileSync(join(directory.path, file.path), file.content);
        }
        const options = await prettier.resolveConfig(filepath, {
            config: join(directory.path, '.gspot/config/prettier.json'),
            editorconfig: true,
            useCache: false,
        });
        expect(await prettier.format(text, { ...options, filepath }), path).toBe(before);
    },
);
