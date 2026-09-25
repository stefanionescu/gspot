import { initCommand } from '#cli/commands/init/command.ts';
import { evaluateEslint } from '#cli/evaluation/eslint.ts';
import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { declaredConfigurations } from '#cli/repository/existing-tooling.ts';
import { expect, test } from 'bun:test';
import { ESLint } from 'eslint';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';

const modules = join(import.meta.dir, '../../../../../node_modules');

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
        stringify({ version: 1, configurations: ['javascript'], tools: { eslint: carried } }),
    );
    const renderSession5 = await openSession(directory.path);
    const generated = emitAll(renderSession5.policyFiles.policy, renderSession5.repository, renderSession5.scopes, {
        version: renderSession5.version,
        packageManager: renderSession5.packageManager,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
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
        stringify({ version: 1, configurations: ['javascript'], tools: { eslint: carried } }),
    );
    const renderSession6 = await openSession(directory.path);
    const generated = emitAll(renderSession6.policyFiles.policy, renderSession6.repository, renderSession6.scopes, {
        version: renderSession6.version,
        packageManager: renderSession6.packageManager,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
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
    expect(rejected.removed).toStrictEqual([]);
    expect(readFileSync(join(directory.path, '.eslintrc.yaml'), 'utf8')).toContain('invalid-option');
    writeFileSync(join(directory.path, '.eslintrc.yaml'), 'root: true\nrules:\n  eqeqeq: [error, always]\n');
    const accepted = await collectCarried(directory.path, tooling, new Set(['javascript']), ['source.js']);
    expect(accepted.unread).toStrictEqual([]);
    expect(accepted.removed.map((entry) => entry.path)).toStrictEqual(['.eslintrc.yaml']);
    expect(accepted.tools.get('eslint')?.settings['adopted']).toStrictEqual(
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
    expect(carried.unread).toStrictEqual([]);
    expect(carried.removed).toStrictEqual([]);
    expect(carried.retained.map((entry) => entry.path)).toStrictEqual(['package.json']);
    expect(carried.tools.get('eslint')?.settings['adopted']).toStrictEqual(
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
    expect(carried.unread).toStrictEqual([]);
    expect(carried.removed.map((entry) => entry.path)).toStrictEqual(Object.keys(configs));
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            configurations: ['javascript'],
            tools: { eslint: { adopted: carried.tools.get('eslint')?.settings['adopted'] } },
        }),
    );
    const renderSession7 = await openSession(directory.path);
    const generated = emitAll(renderSession7.policyFiles.policy, renderSession7.repository, renderSession7.scopes, {
        version: renderSession7.version,
        packageManager: renderSession7.packageManager,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
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

test('legacy ESLint cannot change a captured ignore file before init publishes configuration', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'package.json': '{"type":"module"}',
        '.eslintignore': 'reviewed/**\n',
        '.eslintrc.cjs': String.raw`require("node:fs").writeFileSync(require("node:path").join(__dirname, ".eslintignore"), "changed/**\n"); module.exports = {root: true, rules: {eqeqeq: "error"}};`,
        'source.js': 'var value = 1;\n',
    });
    symlinkSync(modules, join(directory.path, 'node_modules'));
    await expect(
        initCommand({
            cwd: directory.path,
            yes: true,
            isDryRun: false,
            json: true,
            configurations: ['javascript'],
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
    expect(carried.unread).toStrictEqual([]);
    expect(carried.removed.map((entry) => entry.path).toSorted()).toStrictEqual(['.eslintignore', '.eslintrc.cjs']);
    expect(carried.observed.get('.eslintignore')?.bytes.toString()).toBe('changed/**\n');
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        stringify({
            version: 1,
            configurations: ['javascript'],
            tools: { eslint: carried.tools.get('eslint')!.settings },
        }),
    );
    const renderSession8 = await openSession(directory.path);
    const generated = emitAll(renderSession8.policyFiles.policy, renderSession8.repository, renderSession8.scopes, {
        version: renderSession8.version,
        packageManager: renderSession8.packageManager,
        takeover: carried.observed,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
    writeFileSync(join(directory.path, generated.path), generated.content);
    const eslint = new ESLint({ cwd: directory.path, overrideConfigFile: join(directory.path, generated.path) });
    expect(await eslint.isPathIgnored(join(directory.path, 'changed/future.js'))).toBe(true);
    expect(await eslint.isPathIgnored(join(directory.path, 'reviewed/future.js'))).toBe(false);
});
