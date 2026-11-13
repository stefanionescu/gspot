import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { LEVELS } from '#cli/config/manifests.ts';
import { setRuntime } from '#cli/configurations/language/javascript/files/eslint-functions.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { EslintConfiguration } from '#tests/types/setup.ts';

test('a runtime that the globals package does not name stops the config', () => {
    expect(() => setRuntime({}, { node: {}, browser: {} }, 'nodejs', 'module')).toThrow(/\bnodejs\b/u);
});

test('ESLint resolves imports over several projects without a warning', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['typescript'] }],
            tables: '[[import_rule]]\nname = "app"\npaths = ["app/**"]\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'app/tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'root.ts': "import { value } from './app/value.ts';\nexport const root: number = value;\n",
        'app/value.ts': 'export const value = 1;\n',
    });
    await buildEslint(sandbox.path);
    const eslint = join(sandbox.path, 'node_modules/eslint/bin/eslint.js');
    const config = getManifestTarget('javascript', 'eslint/eslint.mjs');
    const result = await runCommand(['node', eslint, '--config', config, '--format', 'json', 'root.ts'], {
        cwd: sandbox.path,
    });
    expect(result.stdout).toStartWith('[');
    expect(result.stderr).toBe('');
});

test('a failed Astro import restores the working folder', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['astro']),
        'Card.astro': '<p>Hello</p>',
        'node_modules/eslint-plugin-astro/package.json': JSON.stringify({
            name: 'eslint-plugin-astro',
            exports: { './package.json': './package.json' },
        }),
    });
    const previousFolder = process.cwd();
    const eslint = await buildEslint(sandbox.path);
    const error = await captureRejection(eslint.lintFiles(['Card.astro']));
    expect(error.message).toContain('lib/index.mjs');
    expect(process.cwd()).toBe(previousFolder);
});

test('all applies your rule options except in script and test files', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[tools.eslint.rules]\n"n/no-process-exit" = []\n"n/no-unpublished-import" = []\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
        'scripts/run.js': '',
        'tests/example.test.js': '',
    });

    const eslint = await buildEslint(sandbox.path);
    const source = (await eslint.calculateConfigForFile('source.js')) as EslintConfiguration;
    const script = (await eslint.calculateConfigForFile('scripts/run.js')) as EslintConfiguration;
    const testFile = (await eslint.calculateConfigForFile('tests/example.test.js')) as EslintConfiguration;
    expect(source.rules['n/no-process-exit']![0]).toBe(2);
    expect(script.rules['n/no-process-exit']![0]).toBe(0);
    expect(testFile.rules['n/no-unpublished-import']![0]).toBe(0);
});

const CONFIGURATION_RULE_OPTIONS = {
    tables: '[tools.eslint.rules]\n"@typescript-eslint/no-floating-promises" = [{ ignoreVoid = true }]\n',
    files: {
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json':
            '{"compilerOptions":{"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["source.ts"]}\n',
        'source.ts': 'void Promise.resolve();\nPromise.resolve();\n',
    },
} as const;

test('your options for a rule that a configuration adds, such as @typescript-eslint/no-floating-promises, reach the ESLint file at level all', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript'], {
            level: 'all',
            tables: CONFIGURATION_RULE_OPTIONS.tables,
        }),
        ...CONFIGURATION_RULE_OPTIONS.files,
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, ['source.ts'], ['@typescript-eslint/no-floating-promises']),
    ).toStrictEqual([{ file: 'source.ts', rule: '@typescript-eslint/no-floating-promises', line: 2 }]);
});

test.each(LEVELS)('ESLint refuses options for a rule that no block turns on at level %s', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level,
            tables: '[tools.eslint.rules]\n"id-length" = []\n"acme/foo" = []\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
    });
    const eslint = await buildEslint(sandbox.path);
    const error = await captureRejection(eslint.calculateConfigForFile('source.js'));
    expect(error.message).toContain('id-length');
    expect(error.message).toContain('acme/foo');
});

test('a Vue component that does not parse gets a fatal parse message', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['vue', 'typescript']),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*"]}',
        'Broken.vue': '<script setup lang="ts">const value = ;</script>\n<template><p>Hello</p></template>\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const [result] = await eslint.lintFiles(['Broken.vue']);
    expect(result?.messages.map(({ fatal }) => fatal)).toStrictEqual([true]);
});
