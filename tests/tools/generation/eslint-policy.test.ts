import { join } from 'node:path';
import type { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { toolProjectSchema } from '#cli/parsers/schema/packages.ts';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import type { EslintSuppressionCase } from '#tests/types/generation/configuration-files.ts';

import {
    COALESCING_SCRIPT,
    COALESCING_SOURCE,
    SUPPRESSION_CASES,
    SUPPRESSION_SCRIPT,
    TYPE_EXPORT_SCRIPT,
    SUPPRESSION_PROJECT,
    TYPE_EXPORT_PROJECT,
    COALESCING_CORRECTION,
    SUPPRESSION_CORRECTION,
    TYPE_EXPORT_CORRECTION,
} from '#tests/config/tools/generation/eslint-policy.ts';

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
        await createEslint(sandbox.path);
        const result = await runTestCommand(['node', '--input-type=module', '-e', COALESCING_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toBe(
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
        const corrected = await runTestCommand(['node', '--input-type=module', '-e', COALESCING_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout).toBe(JSON.stringify({ layout: [], findings: [], formatting: [false, true] }));
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    },
);

test.each(SUPPRESSION_CASES)(
    '$level reports unused directives once and loads reason checks only when required: $requireReasons',
    async ({ level, requireReasons }: EslintSuppressionCase) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['javascript'], { level, tables: `require_reasons = ${String(requireReasons)}\n` });
        await createFileTree(sandbox.path, { ...SUPPRESSION_PROJECT, 'gspot.toml': policy });
        const eslint = await createEslint(sandbox.path);
        const resolved = (await eslint.calculateConfigForFile(join(sandbox.path, 'unused.js'))) as Linter.Config;
        expect(resolved.plugins?.['@eslint-community/eslint-comments']).toBe(
            requireReasons ? eslintComments : undefined,
        );
        const packages = toolProjectSchema.parse(await Bun.file(join(sandbox.path, '.gspot/package.json')).json());
        expect(packages.devDependencies['@eslint-community/eslint-plugin-eslint-comments']).toBe(
            requireReasons ? '4.8.0' : undefined,
        );
        const result = await runTestCommand(['node', '--input-type=module', '-e', SUPPRESSION_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const settings = {
            unusedSeverity: 2,
            legacy: false,
            plugin: requireReasons,
            description: requireReasons ? [2] : null,
        };
        expect(result.stdout).toBe(
            JSON.stringify({
                ...settings,
                findings: [
                    [{ ruleId: null, line: 1, column: 1, severity: 2 }],
                    requireReasons
                        ? [
                              {
                                  ruleId: '@eslint-community/eslint-comments/require-description',
                                  line: 1,
                                  column: 0,
                                  severity: 2,
                              },
                          ]
                        : [],
                ],
            }),
        );
        await createFileTree(sandbox.path, SUPPRESSION_CORRECTION);
        const corrected = await runTestCommand(['node', '--input-type=module', '-e', SUPPRESSION_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout).toBe(JSON.stringify({ ...settings, findings: [[], []] }));
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
        await createEslint(sandbox.path);
        const fixed = await runTestCommand(['node', '--input-type=module', '-e', TYPE_EXPORT_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(fixed.stdout).toBe(
            JSON.stringify({
                source: level === 'all' ? TYPE_EXPORT_CORRECTION : TYPE_EXPORT_PROJECT['index.ts'],
                findings: [],
            }),
        );
        const replay = await runTestCommand(['node', '--input-type=module', '-e', TYPE_EXPORT_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(replay.code, replay.stdout + replay.stderr).toBe(0);
        expect(replay.stdout).toBe(fixed.stdout);
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
