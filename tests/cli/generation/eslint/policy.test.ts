import { ESLint } from 'eslint';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { check, format } from 'prettier';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { toolProjectSchema } from '#cli/parsers/packages/contracts.ts';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import { createEslint, eslintConfigurationSchema } from '#tests/harness/generated.ts';

import {
    COALESCING_SOURCE,
    SUPPRESSION_PROJECT,
    TYPE_EXPORT_PROJECT,
    COALESCING_CORRECTION,
    SUPPRESSION_CORRECTION,
    TYPE_EXPORT_CORRECTION,
} from '#tests/config/cli/generation/eslint/policy.ts';

test.each(['recommended', 'all'] as const)(
    '%s leaves layout to Prettier and applies empty-object selectors at their level',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['javascript'], { level });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'package.json': '{"private":true,"type":"module"}',
            'source.js': COALESCING_SOURCE,
        });
        const eslint = await createEslint(sandbox.path);
        async function lintReport() {
            const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile('source.js'));
            const layout = ['padding-line-between-statements', 'lines-between-class-members'].filter(
                (name) => config.rules[name]?.[0] !== undefined && config.rules[name][0] !== 0,
            );
            const results = await eslint.lintFiles(['source.js']);
            const source = 'export class Example{first(){return 1;}second(){return 2;}}';
            return JSON.stringify({
                layout,
                findings: results.flatMap(({ messages }) =>
                    messages
                        .filter(({ ruleId, fatal }) => ruleId === 'no-restricted-syntax' || fatal)
                        .map(({ ruleId, line, column, severity }) => ({ ruleId, line, column, severity })),
                ),
                formatting: [
                    await check(source, { parser: 'babel' }),
                    await check(await format(source, { parser: 'babel' }), { parser: 'babel' }),
                ],
            });
        }
        const result = await lintReport();
        expect(result).toBe(
            JSON.stringify({
                layout: [],
                findings:
                    level === 'all'
                        ? [
                              { ruleId: 'no-restricted-syntax', line: 2, column: 23, severity: 2 },
                              { ruleId: 'no-restricted-syntax', line: 3, column: 12, severity: 2 },
                          ]
                        : [],
                formatting: [false, true],
            }),
        );
        await Bun.write(join(sandbox.path, 'source.js'), COALESCING_CORRECTION);
        const corrected = await lintReport();
        expect(corrected).toBe(JSON.stringify({ layout: [], findings: [], formatting: [false, true] }));
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s reports unused directives once and requires suppression reasons',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['javascript'], { level });
        await createFileTree(sandbox.path, { ...SUPPRESSION_PROJECT, 'gspot.toml': policy });
        const eslint = await createEslint(sandbox.path);
        const computed = eslintConfigurationSchema.parse(
            await eslint.calculateConfigForFile(join(sandbox.path, 'unused.js')),
        );
        expect(computed.plugins['@eslint-community/eslint-comments']).toBe(eslintComments);
        const packages = toolProjectSchema.parse(await Bun.file(join(sandbox.path, '.gspot/package.json')).json());
        expect(packages.devDependencies['@eslint-community/eslint-plugin-eslint-comments']).toBe('4.8.0');
        async function lintReport() {
            const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile('unused.js'));
            const prefix = '@eslint-community/eslint-comments/';
            const results = await eslint.lintFiles(['unused.js', 'missing.js']);
            return JSON.stringify({
                unusedSeverity: config.linterOptions.reportUnusedDisableDirectives,
                legacy: Object.hasOwn(config.rules, prefix + 'no-unused-disable'),
                plugin: Object.hasOwn(config.plugins, '@eslint-community/eslint-comments'),
                description: config.rules[prefix + 'require-description'] ?? null,
                findings: results.map(({ messages }) =>
                    messages
                        .filter(({ ruleId, fatal }) => ruleId === null || ruleId.startsWith(prefix) || fatal)
                        .map(({ ruleId, line, column, severity }) => ({ ruleId, line, column, severity })),
                ),
            });
        }
        const result = await lintReport();
        const settings = {
            unusedSeverity: 2,
            legacy: false,
            plugin: true,
            description: [2],
        };
        expect(result).toBe(
            JSON.stringify({
                ...settings,
                findings: [
                    [{ ruleId: null, line: 1, column: 1, severity: 2 }],
                    [
                        {
                            ruleId: '@eslint-community/eslint-comments/require-description',
                            line: 1,
                            column: 0,
                            severity: 2,
                        },
                    ],
                ],
            }),
        );
        await createFileTree(sandbox.path, SUPPRESSION_CORRECTION);
        const corrected = await lintReport();
        expect(corrected).toBe(JSON.stringify({ ...settings, findings: [[], []] }));
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s native type fixes preserve value exports and use separate import and export statements',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...TYPE_EXPORT_PROJECT,
            'gspot.toml': buildPolicy(['typescript'], {
                level,
                tables: '[structure]\nreexports = "index-only"\n',
            }),
        });
        const eslint = await createEslint(sandbox.path, {
            fix: ({ ruleId }) =>
                ['@typescript-eslint/consistent-type-imports', '@typescript-eslint/consistent-type-exports'].includes(
                    ruleId ?? '',
                ),
        });
        async function lintReport() {
            const selected = new Set([
                '@typescript-eslint/consistent-type-imports',
                '@typescript-eslint/consistent-type-exports',
            ]);
            const results = await eslint.lintFiles(['index.ts']);
            await ESLint.outputFixes(results);
            const output = results[0]!.output;
            return JSON.stringify({
                source: await format(output ?? (await Bun.file(join(sandbox.path, 'index.ts')).text()), {
                    parser: 'typescript',
                }),
                findings: results.flatMap(({ messages }) =>
                    messages.filter(({ ruleId, fatal }) => (ruleId !== null && selected.has(ruleId)) || fatal),
                ),
            });
        }
        const fixed = await lintReport();
        expect(fixed).toBe(
            JSON.stringify({
                source: level === 'all' ? TYPE_EXPORT_CORRECTION : TYPE_EXPORT_PROJECT['index.ts'],
                findings: [],
            }),
        );
        const replay = await lintReport();
        expect(replay).toBe(fixed);
        const compiled = await runTestCommand(
            ['node', 'node_modules/typescript/lib/tsc.js', '--project', 'tsconfig.json', '--outDir', 'build'],
            { cwd: sandbox.path },
        );
        expect(compiled.code, compiled.stdout + compiled.stderr).toBe(0);
        const runtime = await runTestCommand(
            [
                'node',
                '--input-type=module',
                '-e',
                'const module = await import("./build/index.js"); console.log(JSON.stringify(module));',
            ],
            { cwd: sandbox.path },
        );
        expect(runtime.code, runtime.stdout + runtime.stderr).toBe(0);
        expect(runtime.stdout).toBe('{"value":{"name":"example"}}\n');
        for (const file of ['value.ts', 'tsconfig.json'] as const)
            expect(await Bun.file(join(sandbox.path, file)).text()).toBe(TYPE_EXPORT_PROJECT[file]);
    },
);
