import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from 'smol-toml';
import { ESLint } from 'eslint';
import prettier from 'prettier';
import { run } from '#cli/platform/spawn.ts';
import { initCommand } from '#cli/lifecycle/init/command.ts';
import { declaredConfigurations } from '#cli/repository/existing-tooling.ts';
import { evaluateEslint } from '#cli/lifecycle/eslint-evaluation.ts';
import { collectCarried } from '#cli/lifecycle/takeover.ts';
import { evaluateFormat } from '#cli/lifecycle/format-evaluation.ts';
import { openSession } from '#cli/run/session.ts';
import { emitAll } from '#cli/emit/targets.ts';

const modules = join(import.meta.dir, '../../../../node_modules');

test.each(['eslint', 'prettier'] as const)(
    '%s adoption refuses an external configuration before executing it',
    async (tool) => {
        await using directory = await testdir();
        const filename = tool === 'eslint' ? 'eslint.config.mjs' : 'prettier.config.mjs';
        const content = `import {writeFileSync} from 'node:fs'; writeFileSync(new URL('./executed', import.meta.url), 'escaped'); export default ${tool === 'eslint' ? '[]' : '{}'};`;
        await createFileTree(directory.path, {
            'project/package.json': '{"type":"module"}',
            [`outside/${filename}`]: content,
        });
        const root = join(directory.path, 'project');
        symlinkSync(modules, join(root, 'node_modules'));
        symlinkSync(`../outside/${filename}`, join(root, filename));
        await expect(
            tool === 'eslint'
                ? evaluateEslint({ root, paths: [], flat: true })
                : evaluateFormat({ root, from: filename }),
        ).rejects.toThrow('private regular file');
        expect(existsSync(join(directory.path, 'outside/executed'))).toBe(false);
        expect(readFileSync(join(directory.path, 'outside', filename), 'utf8')).toBe(content);
    },
);

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
    expect(carried.unread).toEqual([]);
    expect(carried.removed.map(({ path }) => path)).toEqual(Object.keys(configs));
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            presets: ['formatting'],
            format: carried.formatter?.format,
            tools: { prettier: { extra: carried.formatter?.extra } },
        }),
    );
    const generated = emitAll(await openSession(directory.path)).files.find(
        (file) => file.path === '.gspot/prettier.json',
    )!;
    mkdirSync(join(directory.path, '.gspot'));
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
    const current = await prettier.resolveConfig(filepath, {
        config: join(directory.path, generated.path),
        useCache: false,
    });
    expect(await prettier.format(text, { ...current, filepath })).toBe(expected);
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
            configs: [
                {
                    tool: 'swiftlint',
                    check: 'swift/swiftlint',
                    path: '.swiftlint.yml',
                    carries: 'rules-table' as const,
                },
            ],
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

test.each(['object', 'named'])(
    'ESLint adoption preserves a %s processor and selector base for future files',
    async (representation) => {
        await using directory = await testdir();
        const processorName = representation === 'object' ? 'source.with.dots' : 'source';
        await createFileTree(directory.path, {
            'package.json': '{"type":"module"}',
            'processing.mjs': `export default {
                processors: { ${JSON.stringify(processorName)}: {
                    preprocess(text) { return [text.replaceAll('marker', 'forbidden')]; },
                    postprocess(messages) { return messages.flat(); }
                } },
                rules: { sentinel: {
                    meta: { schema: [] },
                    create(context) { return { Identifier(node) {
                        if (node.name === 'forbidden') context.report({node,message:'processed finding'});
                    } }; }
                } }
            };`,
            'eslint.config.mjs': `import custom from './processing.mjs';
                export default [{
                    basePath: 'src', files: ['**/*.js'], ignores: ['ignored/**'], plugins: { custom },
                    processor: ${representation === 'object' ? `custom.processors[${JSON.stringify(processorName)}]` : JSON.stringify(`custom/${processorName}`)},
                    rules: { 'custom/sentinel': 'error' }
                }];`,
            'src/current.js': 'export const marker = 1;\n',
        });
        symlinkSync(modules, join(directory.path, 'node_modules'));
        const carried = await evaluateEslint({ root: directory.path, paths: ['src/current.js'], flat: true });
        expect(carried.adopted[0]?.basePath).toBe('src');
        expect(carried.adopted[0]?.processor).toEqual(
            representation === 'object'
                ? { module: './processing.mjs', export: 'default', members: ['processors', processorName] }
                : `custom/${processorName}`,
        );
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
        for (const [path, count] of [
            ['src/future.js', 1],
            ['elsewhere/future.js', 0],
            ['src/ignored/future.js', 0],
        ] as const) {
            const result = await eslint.lintText('export const marker = 1;\n', { filePath: path });
            expect(
                result.flatMap((file) => file.messages).filter((finding) => finding.ruleId === 'custom/sentinel'),
            ).toHaveLength(count);
        }
        const corrected = await eslint.lintText('export const permitted = 1;\n', { filePath: 'src/future.js' });
        expect(
            corrected.flatMap((file) => file.messages).filter((finding) => finding.ruleId === 'custom/sentinel'),
        ).toEqual([]);
    },
);

test.each([
    ['esm', 'eslint.config.mjs', 'import inherited from "./shared.cjs"; export default inherited;'],
    ['commonjs', 'eslint.config.cjs', 'const inherited = require("./shared.cjs"); module.exports = inherited;'],
    [
        'dynamic import',
        'eslint.config.mjs',
        'const {default: inherited} = await import("./shared.cjs"); export default inherited;',
    ],
])(
    'inherited %s configuration keeps executable registrations in its imported module',
    async (_kind, filename, source) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'package.json': '{"type":"module"}',
            'shared.cjs': `const plugin = {rules: {sentinel: {
            meta: {schema: []}, create(context) {return {Identifier(node) {
                if (node.name === 'forbidden') context.report({node,message:'inherited finding'});
            }};}
        }}};
        module.exports = [{files:['**/*.js'],plugins:{inherited:plugin},rules:{'inherited/sentinel':'error'}}];`,
            [filename]: source,
        });
        symlinkSync(modules, join(directory.path, 'node_modules'));
        const carried = await evaluateEslint({ root: directory.path, paths: [], flat: true });
        expect(carried.adopted[0]?.plugins?.['inherited']).toEqual({
            module: './shared.cjs',
            export: 'default',
            members: ['0', 'plugins', 'inherited'],
        });
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
        const failures = await eslint.lintText('export const forbidden = 1;', { filePath: 'future.js' });
        expect(
            failures.flatMap((file) => file.messages).filter((finding) => finding.ruleId === 'inherited/sentinel'),
        ).toHaveLength(1);
        const corrected = await eslint.lintText('export const allowed = 1;', { filePath: 'future.js' });
        expect(
            corrected.flatMap((file) => file.messages).filter((finding) => finding.ruleId === 'inherited/sentinel'),
        ).toEqual([]);
        const native = await run(
            [
                'node',
                '--input-type=module',
                '-e',
                `
                import { ESLint } from 'eslint';
                const eslint = new ESLint({overrideConfigFile: '.gspot/eslint.config.mjs'});
                const results = [];
                for (const name of ['forbidden', 'allowed']) {
                    const files = await eslint.lintText('export const ' + name + ' = 1;', {filePath: 'future.js'});
                    results.push(files.flatMap(file => file.messages).filter(message => message.ruleId === 'inherited/sentinel'));
                }
                console.log(JSON.stringify(results));
            `,
            ],
            { cwd: directory.path, timeoutMs: 10_000 },
        );
        expect(native.stderr).toBe('');
        expect(native.code).toBe(0);
        const [nativeFailures, nativeCorrected] = JSON.parse(native.stdout);
        expect(nativeFailures).toMatchObject([{ ruleId: 'inherited/sentinel', line: 1, column: 14 }]);
        expect(nativeCorrected).toEqual([]);
    },
);

test.each(['namespace', 'named export with dots'])(
    'ESLint registration preserves a %s without treating export names as property paths',
    async (kind) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'package.json': '{"type":"module"}',
            'plugin.mjs': `const plugin = {rules:{sentinel:{meta:{schema:[]},create(context){
                return {Identifier(node){if(node.name==='forbidden')context.report({node,message:'registered finding'});}};
            }}}}; export const rules = plugin.rules; export {plugin as 'custom.plugin'};`,
            'eslint.config.mjs': `${kind === 'namespace' ? 'import * as custom' : 'import { "custom.plugin" as custom }'} from './plugin.mjs';
                export default [{files:['**/*.js'],plugins:{custom},rules:{'custom/sentinel':'error'}}];`,
        });
        symlinkSync(modules, join(directory.path, 'node_modules'));
        const carried = await evaluateEslint({ root: directory.path, paths: [], flat: true });
        expect(carried.adopted[0]?.plugins?.['custom']).toEqual({
            module: './plugin.mjs',
            export: kind === 'namespace' ? '*' : 'custom.plugin',
        });
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
        for (const [identifier, count] of [
            ['forbidden', 1],
            ['allowed', 0],
        ] as const) {
            const result = await eslint.lintText(`export const ${identifier} = 1;`, { filePath: 'future.js' });
            expect(
                result.flatMap((file) => file.messages).filter((finding) => finding.ruleId === 'custom/sentinel'),
            ).toHaveLength(count);
        }
    },
);

test('legacy ESLint adoption preserves inherited overrides and ignores for future files', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'package.json': '{"type":"module"}',
        'shared.json': JSON.stringify({ rules: { eqeqeq: ['error', 'always'] } }),
        '.eslintrc.json': JSON.stringify({
            root: true,
            extends: './shared.json',
            parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
            ignorePatterns: ['ignored/**', '!ignored/kept.js'],
            overrides: [{ files: ['src/**/*.js'], excludedFiles: ['src/vendor/**'], rules: { 'no-alert': 'error' } }],
        }),
        'src/current.js': 'alert(1);',
    });
    symlinkSync(modules, join(directory.path, 'node_modules'));
    const carried = await evaluateEslint({
        root: directory.path,
        paths: ['src/current.js'],
        flat: false,
        from: '.eslintrc.json',
    });
    expect(carried.adopted.some((entry) => entry.legacyCriteria?.patterns[0]?.includes?.includes('src/**/*.js'))).toBe(
        true,
    );
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
    const findings = await eslint.lintText('alert(1); if (1 == "1") alert(2);', { filePath: 'src/future.js' });
    expect(findings.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'no-alert')).toHaveLength(2);
    expect(findings.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'eqeqeq')).toHaveLength(1);
    const corrected = await eslint.lintText('export const value = 1;', { filePath: 'src/future.js' });
    expect(
        corrected
            .flatMap((entry) => entry.messages)
            .filter((entry) => ['no-alert', 'eqeqeq'].includes(entry.ruleId ?? '')),
    ).toHaveLength(0);
    expect(await eslint.isPathIgnored(join(directory.path, 'ignored/future.js'))).toBe(true);
    expect(await eslint.isPathIgnored(join(directory.path, 'ignored/kept.js'))).toBe(false);
    expect(await eslint.isPathIgnored(join(directory.path, '.hidden.js'))).toBe(true);
    expect(existsSync(join(directory.path, '.eslintrc.json'))).toBe(true);
});

test('legacy ESLint adoption preserves inherited plugin environments and extension processors', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'package.json': '{"type":"module"}',
        'node_modules/eslint-plugin-fixture/package.json': '{"name":"eslint-plugin-fixture","main":"index.cjs"}',
        'node_modules/eslint-plugin-fixture/index.cjs':
            'module.exports = { environments: { fixture: { globals: { allowed: false } } }, processors: { ".txt": { preprocess(text) { return [text]; }, postprocess(messages) { return messages.flat(); } } }, rules: { forbidden: { meta: {schema: []}, create(context) { return { Identifier(node) { if (node.name === "bad") context.report({node,message:"fixture finding"}); } }; } } } };',
        'shared.json': JSON.stringify({ plugins: ['fixture'], rules: { 'fixture/forbidden': 'error' } }),
        '.eslintrc.json': JSON.stringify({
            root: true,
            extends: './shared.json',
            env: { 'fixture/fixture': true },
            parserOptions: { ecmaVersion: 2022 },
        }),
        'source.js': 'allowed;',
    });
    symlinkSync(join(modules, 'eslint'), join(directory.path, 'node_modules/eslint'));
    const carried = await evaluateEslint({
        root: directory.path,
        paths: ['source.js'],
        flat: false,
        from: '.eslintrc.json',
    });
    expect(
        carried.adopted.some(
            (entry) =>
                entry.languageOptions?.['globals'] &&
                (entry.languageOptions['globals'] as Record<string, unknown>)['allowed'] === false,
        ),
    ).toBe(true);
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({ version: 1, presets: ['javascript'], tools: { eslint: carried } }),
    );
    const generated = emitAll(await openSession(directory.path)).files.find(
        (file) => file.path === '.gspot/eslint.config.mjs',
    )!;
    mkdirSync(join(directory.path, '.gspot'));
    symlinkSync(modules, join(directory.path, '.gspot/node_modules'));
    writeFileSync(join(directory.path, generated.path), generated.content);
    const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, generated.path) });
    const findings = await eslint.lintText('bad;', { filePath: 'future.txt' });
    expect(
        findings.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'fixture/forbidden'),
    ).toHaveLength(1);
    const corrected = await eslint.lintText('allowed;', { filePath: 'future.txt' });
    expect(
        corrected.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'fixture/forbidden'),
    ).toHaveLength(0);
});

test('legacy adoption proposes retirement only after native configuration validation', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'package.json': '{"type":"module"}',
        '.eslintrc.yaml': 'root: true\nrules:\n  eqeqeq: [error, invalid-option]\n',
        'source.js': 'var value = 1;',
    });
    symlinkSync(modules, join(directory.path, 'node_modules'));
    const tooling = {
        configs: [{ tool: 'eslint', carries: 'eslint-config' as const, path: '.eslintrc.yaml' }],
        hooks: [],
        ci: [],
        agentFiles: [],
        rulesDirectories: [],
        lintFolders: [],
        lintOnlyManifests: [],
        runner: 'none' as const,
    };
    const rejected = await collectCarried(directory.path, tooling, new Set(['javascript']), ['source.js']);
    expect(rejected.unread).toHaveLength(1);
    expect(rejected.removed).toEqual([]);
    expect(readFileSync(join(directory.path, '.eslintrc.yaml'), 'utf8')).toContain('invalid-option');
    writeFileSync(join(directory.path, '.eslintrc.yaml'), 'root: true\nrules:\n  eqeqeq: [error, always]\n');
    const accepted = await collectCarried(directory.path, tooling, new Set(['javascript']), ['source.js']);
    expect(accepted.unread).toEqual([]);
    expect(accepted.removed.map((entry) => entry.path)).toEqual(['.eslintrc.yaml']);
    expect(accepted.tools.get('eslint')?.settings['adopted']).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ rules: expect.objectContaining({ eqeqeq: expect.anything() }) }),
        ]),
    );
    expect(existsSync(join(directory.path, '.eslintrc.yaml'))).toBe(true);
});

test('legacy package ESLint adoption preserves shared manifest bytes', async () => {
    await using directory = await testdir();
    const original = JSON.stringify({
        name: 'retained-project',
        type: 'module',
        eslintConfig: { root: true, rules: { eqeqeq: 'error' } },
    });
    await createFileTree(directory.path, { 'package.json': original, 'source.js': 'var value = 1;' });
    symlinkSync(modules, join(directory.path, 'node_modules'));
    const carried = await collectCarried(
        directory.path,
        {
            configs: [{ tool: 'eslint', carries: 'eslint-config', path: 'package.json' }],
            hooks: [],
            ci: [],
            agentFiles: [],
            rulesDirectories: [],
            lintFolders: [],
            lintOnlyManifests: [],
            runner: 'none',
        },
        new Set(['javascript']),
        ['source.js'],
    );
    expect(carried.unread).toEqual([]);
    expect(carried.removed).toEqual([]);
    expect(carried.retained.map((entry) => entry.path)).toEqual(['package.json']);
    expect(carried.tools.get('eslint')?.settings['adopted']).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ rules: expect.objectContaining({ eqeqeq: expect.anything() }) }),
        ]),
    );
    expect(readFileSync(join(directory.path, 'package.json'), 'utf8')).toBe(original);
});

test('cascading legacy ESLint preserves root resets and directory-relative overrides', async () => {
    await using directory = await testdir();
    const configs = {
        '.eslintrc.json': JSON.stringify({
            root: true,
            parserOptions: { ecmaVersion: 2022 },
            rules: { 'no-alert': 'error' },
        }),
        'nested/.eslintrc.json': JSON.stringify({
            overrides: [{ files: ['./*.js'], rules: { 'no-debugger': 'warn' } }],
        }),
        'isolated/.eslintrc.json': JSON.stringify({
            root: true,
            parserOptions: { ecmaVersion: 2022 },
            rules: { 'no-alert': 'off' },
        }),
    };
    await createFileTree(directory.path, { 'package.json': '{"type":"module"}', ...configs });
    symlinkSync(modules, join(directory.path, 'node_modules'));
    const carried = await collectCarried(
        directory.path,
        {
            configs: Object.keys(configs).map((path) => ({ tool: 'eslint', carries: 'eslint-config' as const, path })),
            hooks: [],
            ci: [],
            agentFiles: [],
            rulesDirectories: [],
            lintFolders: [],
            lintOnlyManifests: [],
            runner: 'none',
        },
        new Set(['javascript']),
        [],
    );
    expect(carried.unread).toEqual([]);
    expect(carried.removed.map((entry) => entry.path)).toEqual(Object.keys(configs));
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            presets: ['javascript'],
            tools: { eslint: { adopted: carried.tools.get('eslint')?.settings['adopted'] } },
        }),
    );
    const generated = emitAll(await openSession(directory.path)).files.find(
        (file) => file.path === '.gspot/eslint.config.mjs',
    )!;
    mkdirSync(join(directory.path, '.gspot'));
    writeFileSync(join(directory.path, generated.path), generated.content);
    const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, generated.path) });
    const nested = await eslint.lintText('alert(1); debugger;', { filePath: 'nested/future.js' });
    expect(nested.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'no-alert')).toHaveLength(1);
    expect(nested.flatMap((entry) => entry.messages).find((entry) => entry.ruleId === 'no-debugger')?.severity).toBe(1);
    const deep = await eslint.lintText('debugger;', { filePath: 'nested/deep/future.js' });
    expect(deep.flatMap((entry) => entry.messages).find((entry) => entry.ruleId === 'no-debugger')?.severity).toBe(2);
    const isolated = await eslint.lintText('alert(1);', { filePath: 'isolated/future.js' });
    expect(isolated.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'no-alert')).toHaveLength(0);
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
    expect(carried.unread).toEqual([]);
    expect(carried.removed.map((entry) => entry.path)).toEqual(Object.keys(configs));
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            presets: ['formatting'],
            tools: { editorconfig: { adopted: carried.formatter?.editorconfig }, prettier: { native_defaults: true } },
        }),
    );
    const generated = emitAll(await openSession(directory.path), carried.observed);
    const editors = generated.files.filter((file) => file.path.endsWith('.editorconfig'));
    expect(editors.map((file) => file.path).sort()).toEqual(Object.keys(configs).sort());
    for (const file of editors) writeFileSync(join(directory.path, file.path), file.content);
    const after = await Promise.all(
        paths.map((path) =>
            prettier.resolveConfig(join(directory.path, path), { editorconfig: true, useCache: false }),
        ),
    );
    expect(after).toEqual(before);
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
    expect(carried.unread).toEqual([]);
    expect(carried.formatter?.nativeDefaults).toBe(true);
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            presets: ['formatting'],
            format: carried.formatter?.format,
            tools: {
                prettier: { native_defaults: carried.formatter?.nativeDefaults, extra: carried.formatter?.extra },
                editorconfig: { adopted: carried.formatter?.editorconfig },
            },
        }),
    );
    const generated = emitAll(await openSession(directory.path), carried.observed);
    for (const file of generated.files.filter(
        (file) => file.path.endsWith('.editorconfig') || file.path === '.gspot/prettier.json',
    )) {
        mkdirSync(join(directory.path, file.path, '..'), { recursive: true });
        writeFileSync(join(directory.path, file.path), file.content);
    }
    for (const [index, [path, text]] of cases.entries()) {
        const filepath = join(directory.path, path);
        const options = await prettier.resolveConfig(filepath, {
            config: join(directory.path, '.gspot/prettier.json'),
            editorconfig: true,
            useCache: false,
        });
        expect(await prettier.format(text, { ...options, filepath }), path).toBe(before[index]!);
    }
});

test.each([
    ['eslint.config.mjs', 'import plugin from "./plugin.cjs"; export default [{plugins: {custom: plugin}}];'],
    ['eslint.config.cjs', 'const plugin = require("./plugin.cjs"); module.exports = [{plugins: {custom: plugin}}];'],
    [
        'eslint.config.mjs',
        'const {default: plugin} = await import("./plugin.cjs"); export default [{plugins: {custom: plugin}}];',
    ],
])('ESLint adoption rejects an external module from %s before executing it', async (filename, configuration) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/package.json': '{"type":"module"}',
        [`project/${filename}`]: configuration,
        'outside/plugin.cjs':
            'require("node:fs").writeFileSync(require("node:path").join(__dirname, "executed"), "escaped"); module.exports = {rules: {}};',
    });
    symlinkSync(modules, join(directory.path, 'project/node_modules'));
    symlinkSync('../outside/plugin.cjs', join(directory.path, 'project/plugin.cjs'));
    await expect(evaluateEslint({ root: join(directory.path, 'project'), paths: [], flat: true })).rejects.toThrow(
        'outside the repository',
    );
    expect(existsSync(join(directory.path, 'outside/executed'))).toBe(false);
});

test('legacy ESLint cannot change a captured ignore file before init publishes configuration', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'package.json': '{"type":"module"}',
        '.eslintignore': 'reviewed/**\n',
        '.eslintrc.cjs':
            'require("node:fs").writeFileSync(require("node:path").join(__dirname, ".eslintignore"), "changed/**\\n"); module.exports = {root: true, rules: {eqeqeq: "error"}};',
        'source.js': 'var value = 1;\n',
    });
    symlinkSync(modules, join(directory.path, 'node_modules'));
    await expect(
        initCommand({
            cwd: directory.path,
            yes: true,
            isDryRun: false,
            json: true,
            presets: ['javascript'],
            hooks: 'none',
            runner: 'none',
            ci: 'none',
            rules: 'no',
            install: false,
            allowDirty: true,
        }),
    ).rejects.toThrow('Configuration changed after takeover was planned: .eslintignore');
    expect(readFileSync(join(directory.path, '.eslintignore'), 'utf8')).toBe('changed/**\n');
    expect(existsSync(join(directory.path, '.eslintrc.cjs'))).toBe(true);
    expect(existsSync(join(directory.path, 'gspot.toml'))).toBe(false);
    writeFileSync(join(directory.path, '.eslintrc.cjs'), 'module.exports = {root: true, rules: {eqeqeq: "error"}};');
    const carried = await collectCarried(
        directory.path,
        {
            configs: declaredConfigurations(directory.path, ['.eslintrc.cjs', '.eslintignore']),
            hooks: [],
            ci: [],
            agentFiles: [],
            rulesDirectories: [],
            lintFolders: [],
            lintOnlyManifests: [],
            runner: 'none',
        },
        new Set(['javascript']),
        ['source.js'],
    );
    expect(carried.unread).toEqual([]);
    expect(carried.removed.map((entry) => entry.path).toSorted()).toEqual(['.eslintignore', '.eslintrc.cjs']);
    expect(carried.observed.get('.eslintignore')?.bytes.toString()).toBe('changed/**\n');
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({ version: 1, presets: ['javascript'], tools: { eslint: carried.tools.get('eslint')!.settings } }),
    );
    const generated = emitAll(await openSession(directory.path), carried.observed).files.find(
        (file) => file.path === '.gspot/eslint.config.mjs',
    )!;
    mkdirSync(join(directory.path, '.gspot'), { recursive: true });
    writeFileSync(join(directory.path, generated.path), generated.content);
    const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, generated.path) });
    expect(await eslint.isPathIgnored(join(directory.path, 'changed/future.js'))).toBe(true);
    expect(await eslint.isPathIgnored(join(directory.path, 'reviewed/future.js'))).toBe(false);
});
