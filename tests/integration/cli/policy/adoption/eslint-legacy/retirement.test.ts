import { ESLint } from 'eslint';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';
import { rejection } from '#tests/support/rejection.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { INSTALLED_MODULES } from '#tests/support/cli/modules.ts';
import { declaredConfigurations } from '#cli/repository/existing-tooling.ts';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';

test('legacy adoption proposes retirement only after native configuration validation', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'package.json': '{"type":"module"}',
        '.eslintrc.yaml': 'root: true\nrules:\n  eqeqeq: [error, invalid-option]\n',
        'source.js': 'var value = 1;',
    });
    symlinkSync(INSTALLED_MODULES, join(directory.path, 'node_modules'));
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
    symlinkSync(INSTALLED_MODULES, join(directory.path, 'node_modules'));
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

test('legacy ESLint cannot change a captured ignore file before init publishes configuration', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'package.json': '{"type":"module"}',
        '.eslintignore': 'reviewed/**\n',
        '.eslintrc.cjs': String.raw`require("node:fs").writeFileSync(require("node:path").join(__dirname, ".eslintignore"), "changed/**\n"); module.exports = {root: true, rules: {eqeqeq: "error"}};`,
        'source.js': 'var value = 1;\n',
    });
    symlinkSync(INSTALLED_MODULES, join(directory.path, 'node_modules'));
    expect(
        (
            await rejection(
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
            )
        ).message,
    ).toContain('Configuration changed after takeover was planned: .eslintignore');
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
    expect(
        carried.removed.map((entry) => entry.path).toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['.eslintignore', '.eslintrc.cjs']);
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
