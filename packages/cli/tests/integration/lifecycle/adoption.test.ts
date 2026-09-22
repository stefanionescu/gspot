import { join } from 'node:path';
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from 'smol-toml';
import { ESLint } from 'eslint';
import prettier from 'prettier';
import { evaluateEslint } from '#cli/lifecycle/eslint-evaluation.ts';
import { collectCarried } from '#cli/lifecycle/takeover.ts';
import { evaluateFormat } from '#cli/lifecycle/format-evaluation.ts';
import { openSession } from '#cli/run/session.ts';
import { emitAll } from '#cli/emit/targets.ts';

const modules = join(import.meta.dir, '../../../../../node_modules');

test('adopted ESLint preserves plugins, custom rules, options, selectors, and ignores for future files', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'package.json': '{"type":"module"}',
        'rules.mjs':
            'export default { rules: { required: { meta: { schema: [{type:"string"}] }, create(context) { return { Identifier(node) { if(node.name === context.options[0]) context.report({node,message:"custom finding"}); } }; } } } };',
        'eslint.config.mjs':
            'import custom from "./rules.mjs"; export default [{ ignores: ["ignored/**"] }, { files: ["src/**/*.js"], plugins: { custom }, rules: { "custom/required": ["error", "bad"], eqeqeq: ["error", "always"] }, languageOptions: { globals: { allowed: "readonly" } } }];',
        'src/current.js': 'export const bad = 1;',
    });
    symlinkSync(modules, join(directory.path, 'node_modules'));
    const original = readFileSync(join(directory.path, 'eslint.config.mjs'), 'utf8');
    const carried = await evaluateEslint({ root: directory.path, paths: ['src/current.js'], flat: true });
    expect(carried.adopted[1]?.files).toEqual(['src/**/*.js']);
    expect(carried.adopted[1]?.plugins).toEqual({ custom: { module: './rules.mjs', export: 'default' } });
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({ version: 1, presets: ['javascript'], tools: { eslint: carried } }),
    );
    const generated = emitAll(await openSession(directory.path)).files.find(
        (file) => file.path === '.gspot/eslint.config.mjs',
    )!;
    mkdirSync(join(directory.path, '.gspot'));
    writeFileSync(join(directory.path, generated.path), generated.content);
    const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, generated.path) });
    const findings = await eslint.lintText('export const bad = 1;', { filePath: 'src/future.js' });
    expect(
        findings.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'custom/required'),
    ).toHaveLength(1);
    expect(await eslint.isPathIgnored(join(directory.path, 'ignored/future.js'))).toBe(true);
    expect(readFileSync(join(directory.path, 'eslint.config.mjs'), 'utf8')).toBe(original);
});

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
        paths: ['source.js'],
        from: '.prettierrc.json',
        source,
    });
    expect(carried.extra?.['overrides']).toEqual(source.overrides);
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            presets: ['formatting'],
            format: carried.format,
            tools: { prettier: { extra: carried.extra } },
        }),
    );
    const generated = emitAll(await openSession(directory.path)).files.find(
        (file) => file.path === '.gspot/prettier.json',
    )!;
    mkdirSync(join(directory.path, '.gspot'));
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

test('unsupported executable selectors fail conversion without changing original configuration bytes', async () => {
    await using directory = await testdir();
    const original = 'export default [{ files: [(path) => path.endsWith(".js")], rules: {} }];';
    await createFileTree(directory.path, { 'package.json': '{"type":"module"}', 'eslint.config.mjs': original });
    symlinkSync(modules, join(directory.path, 'node_modules'));
    await expect(evaluateEslint({ root: directory.path, paths: [], flat: true })).rejects.toThrow(
        'TOML cannot represent',
    );
    expect(readFileSync(join(directory.path, 'eslint.config.mjs'), 'utf8')).toBe(original);
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
                { tool: 'prettier', path: '.prettierrc.json' },
                { tool: 'prettierignore', path: '.prettierignore' },
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
    expect(carried.unread).toEqual([]);
    expect(carried.removed.map(({ path }) => path)).toEqual(['.prettierrc.json', '.prettierignore']);
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            presets: ['formatting'],
            format: carried.formatter!.format,
            tools: { prettier: { ignore_patterns: carried.formatter!.ignorePatterns } },
        }),
    );
    const generated = emitAll(await openSession(directory.path), carried.observed).files.find(
        ({ path }) => path === '.prettierignore',
    )!;
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

test('unsupported native rule options remain untouched and prevent successful adoption', async () => {
    await using directory = await testdir();
    const original = 'disabled_rules: [force_cast]\ncustom_rules:\n  project_rule:\n    regex: banned\n';
    await createFileTree(directory.path, { '.swiftlint.yml': original });
    const carried = await collectCarried(
        directory.path,
        {
            configs: [{ tool: 'swiftlint', path: '.swiftlint.yml' }],
            hooks: [],
            ci: [],
            agentFiles: [],
            rulesDirectories: [],
            lintFolders: [],
            lintOnlyManifests: [],
            runner: 'none',
        },
        new Set(['swift']),
        [],
    );
    expect(carried.unread[0]?.note).toContain('custom_rules');
    expect(carried.removed).toEqual([]);
    expect(readFileSync(join(directory.path, '.swiftlint.yml'), 'utf8')).toBe(original);
});

test('shared EditorConfig selectors govern files created after generation', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml':
            'version = 1\npresets = ["formatting"]\n[[format.overrides]]\npaths = ["tests/**/*.js"]\nindent_width = 6\n',
        'source.js': 'const value=1;',
    });
    const session = await openSession(directory.path);
    const editor = emitAll(session).files.find(({ path }) => path === '.editorconfig')!;
    expect(editor.content).toContain('[/tests/**/*.js]');
    expect(editor.content).not.toContain('source.js');
    writeFileSync(join(directory.path, editor.path), editor.content);
    expect(
        await prettier.resolveConfig(join(directory.path, 'tests/future.js'), { editorconfig: true, useCache: false }),
    ).toMatchObject({ tabWidth: 6 });
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        'version = 1\npresets = ["formatting"]\n[[format.overrides]]\npaths = ["tests/**", "!tests/vendor/**"]\nindent_width = 6\n',
    );
    const unsupported = await openSession(directory.path);
    expect(() => emitAll(unsupported)).toThrow('EditorConfig cannot represent selector "!tests/vendor/**"');
    expect(readFileSync(join(directory.path, editor.path), 'utf8')).toBe(editor.content);
});

test.each(['new Date("2026-01-01")', 'new Map([["key", "value"]])', '/pattern/u'])(
    'adoption refuses executable settings that JSON would coerce: %s',
    async (value) => {
        await using directory = await testdir();
        const original = `export default [{ settings: { custom: ${value} } }];`;
        await createFileTree(directory.path, { 'package.json': '{"type":"module"}', 'eslint.config.mjs': original });
        symlinkSync(modules, join(directory.path, 'node_modules'));
        await expect(evaluateEslint({ root: directory.path, paths: [], flat: true })).rejects.toThrow(
            'TOML cannot represent',
        );
        expect(readFileSync(join(directory.path, 'eslint.config.mjs'), 'utf8')).toBe(original);
    },
);
