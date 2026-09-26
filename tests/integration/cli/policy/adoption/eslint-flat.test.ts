import { ESLint } from 'eslint';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';
import { evaluateEslint } from '#cli/evaluation/eslint.ts';
import { rejection } from '#tests/support/expectations.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';

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
    expect(carried.adopted[1]?.files).toStrictEqual(['src/**/*.js']);
    expect(carried.adopted[1]?.plugins).toStrictEqual({ custom: { module: './rules.mjs', export: 'default' } });
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({ version: 1, configurations: ['javascript'], tools: { eslint: carried } }),
    );
    const renderSession1 = await openSession(directory.path);
    const generated = emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
        version: renderSession1.version,
        packageManager: renderSession1.packageManager,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
    writeFileSync(join(directory.path, generated.path), generated.content);
    const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, generated.path) });
    const findings = await eslint.lintText('export const bad = 1;', { filePath: 'src/future.js' });
    expect(
        findings.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'custom/required'),
    ).toMatchObject([{ ruleId: 'custom/required', line: 1, column: 14 }]);
    const corrected = await eslint.lintText('export const permitted = 1;', { filePath: 'src/future.js' });
    expect(
        corrected.flatMap((entry) => entry.messages).filter((entry) => entry.ruleId === 'custom/required'),
    ).toStrictEqual([]);
    expect(await eslint.isPathIgnored(join(directory.path, 'ignored/future.js'))).toBe(true);
    expect(readFileSync(join(directory.path, 'eslint.config.mjs'), 'utf8')).toBe(original);
});

test('unsupported executable selectors fail conversion without changing original configuration bytes', async () => {
    await using directory = await testdir();
    const original = 'export default [{ files: [(path) => path.endsWith(".js")], rules: {} }];';
    await createFileTree(directory.path, { 'package.json': '{"type":"module"}', 'eslint.config.mjs': original });
    symlinkSync(modules, join(directory.path, 'node_modules'));
    expect(await rejection(evaluateEslint({ root: directory.path, paths: [], flat: true }))).toContain(
        'TOML cannot represent',
    );
    expect(readFileSync(join(directory.path, 'eslint.config.mjs'), 'utf8')).toBe(original);
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
    expect(carried.removed).toStrictEqual([]);
    expect(readFileSync(join(directory.path, '.swiftlint.yml'), 'utf8')).toBe(original);
});

test.each(['new Date("2026-01-01")', 'new Map([["key", "value"]])', '/pattern/u'])(
    'adoption refuses executable settings that JSON would coerce: %s',
    async (value) => {
        await using directory = await testdir();
        const original = `export default [{ settings: { custom: ${value} } }];`;
        await createFileTree(directory.path, { 'package.json': '{"type":"module"}', 'eslint.config.mjs': original });
        symlinkSync(modules, join(directory.path, 'node_modules'));
        expect(await rejection(evaluateEslint({ root: directory.path, paths: [], flat: true }))).toContain(
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
        expect(carried.adopted[0]?.processor).toStrictEqual(
            representation === 'object'
                ? { module: './processing.mjs', export: 'default', members: ['processors', processorName] }
                : `custom/${processorName}`,
        );
        writeFileSync(
            join(directory.path, 'gspot.toml'),
            stringify({ version: 1, configurations: ['javascript'], tools: { eslint: carried } }),
        );
        const renderSession2 = await openSession(directory.path);
        const generated = emitAll(renderSession2.policyFiles.policy, renderSession2.repository, renderSession2.scopes, {
            version: renderSession2.version,
            packageManager: renderSession2.packageManager,
        }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
        mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
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
        ).toStrictEqual([]);
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
        expect(carried.adopted[0]?.plugins?.['inherited']).toStrictEqual({
            module: './shared.cjs',
            export: 'default',
            members: ['0', 'plugins', 'inherited'],
        });
        writeFileSync(
            join(directory.path, 'gspot.toml'),
            stringify({ version: 1, configurations: ['javascript'], tools: { eslint: carried } }),
        );
        const renderSession3 = await openSession(directory.path);
        const generated = emitAll(renderSession3.policyFiles.policy, renderSession3.repository, renderSession3.scopes, {
            version: renderSession3.version,
            packageManager: renderSession3.packageManager,
        }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
        mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
        writeFileSync(join(directory.path, generated.path), generated.content);
        const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, generated.path) });
        const failures = await eslint.lintText('export const forbidden = 1;', { filePath: 'future.js' });
        expect(
            failures.flatMap((file) => file.messages).filter((finding) => finding.ruleId === 'inherited/sentinel'),
        ).toHaveLength(1);
        const corrected = await eslint.lintText('export const allowed = 1;', { filePath: 'future.js' });
        expect(
            corrected.flatMap((file) => file.messages).filter((finding) => finding.ruleId === 'inherited/sentinel'),
        ).toStrictEqual([]);
        const native = await run(
            [
                'node',
                '--input-type=module',
                '-e',
                `
                import { ESLint } from 'eslint';
                const eslint = new ESLint({overrideConfigFile: '.gspot/config/eslint.config.mjs'});
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
        expect(nativeCorrected).toStrictEqual([]);
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
        expect(carried.adopted[0]?.plugins?.['custom']).toStrictEqual({
            module: './plugin.mjs',
            export: kind === 'namespace' ? '*' : 'custom.plugin',
        });
        writeFileSync(
            join(directory.path, 'gspot.toml'),
            stringify({ version: 1, configurations: ['javascript'], tools: { eslint: carried } }),
        );
        const renderSession4 = await openSession(directory.path);
        const generated = emitAll(renderSession4.policyFiles.policy, renderSession4.repository, renderSession4.scopes, {
            version: renderSession4.version,
            packageManager: renderSession4.packageManager,
        }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
        mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
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
