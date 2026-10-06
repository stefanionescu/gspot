import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { parseOutput } from '#cli/parsers/output/parse.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { installedModules } from '#tests/harness/environment.ts';
import { eslintFilePatterns } from '#cli/generation/eslint/output.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

import {
    NODE_SCRIPT_FILES,
    NODE_SCRIPT_PATHS,
    NODE_SCRIPT_SOURCE,
    NODE_SCRIPT_TABLES,
    NODE_SCRIPT_CONTROLS,
    NODE_SCRIPT_CONTRACTS,
    NODE_SCRIPT_CORRECTED,
    NODE_SCRIPT_LINT_SOURCE,
    NODE_SCRIPT_NATIVE_ROOTS,
    NODE_SCRIPT_PATH_COVERAGE,
    NODE_SCRIPT_REPORT_SOURCE,
    NODE_SCRIPT_CONTRACT_SOURCE,
} from '#tests/config/tools/generation/node-scripts.ts';

test.each(['recommended', 'all'] as const)(
    '%s native ESLint checks tagged Node files and retains typed and excluded file ownership',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...NODE_SCRIPT_FILES,
            'gspot.toml': buildPolicy(['typescript'], { level, tables: NODE_SCRIPT_TABLES }),
        });
        await createEslint(sandbox.path);
        const command = [
            'node',
            '--input-type=module',
            '-e',
            NODE_SCRIPT_LINT_SOURCE,
            JSON.stringify([NODE_SCRIPT_PATHS, NODE_SCRIPT_CONTROLS]),
        ];
        for (const corrected of [false, true]) {
            if (corrected)
                for (const path of NODE_SCRIPT_PATHS) await Bun.write(join(sandbox.path, path), NODE_SCRIPT_CORRECTED);
            const native = await runTestCommand(command, { cwd: sandbox.path });
            expect(native.code, native.stdout + native.stderr).toBe(0);
            expect(native.stdout).toBe(
                JSON.stringify({
                    results: NODE_SCRIPT_PATHS.map((file) => ({
                        file,
                        findings: corrected
                            ? []
                            : [
                                  {
                                      ruleId: file.endsWith('.ts')
                                          ? '@typescript-eslint/no-unused-vars'
                                          : 'no-unused-vars',
                                      line: 2,
                                      severity: 2,
                                  },
                              ],
                    })),
                    configurations: NODE_SCRIPT_CONTROLS.map((file) => ({ file, matched: false })),
                }),
            );
        }
        for (const file of NODE_SCRIPT_CONTROLS)
            expect(await Bun.file(join(sandbox.path, file)).text()).toBe(NODE_SCRIPT_FILES[file]);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s native extensionless Node contracts report syntax, runtime, imports and scoped structural limits',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...NODE_SCRIPT_FILES,
            'gspot.toml': buildPolicy(['typescript'], { level, tables: NODE_SCRIPT_TABLES }),
            ...Object.fromEntries(NODE_SCRIPT_CONTRACTS.map(({ file, source }) => [file, source])),
            'source.js': 'export const value = 1;\n',
        });
        await createEslint(sandbox.path);
        const command = [
            'node',
            '--input-type=module',
            '-e',
            NODE_SCRIPT_CONTRACT_SOURCE,
            JSON.stringify(NODE_SCRIPT_CONTRACTS.map(({ file }) => file)),
        ];
        for (const corrected of [false, true]) {
            if (corrected)
                for (const contract of NODE_SCRIPT_CONTRACTS)
                    await Bun.write(join(sandbox.path, contract.file), contract.corrected);
            const native = await runTestCommand(command, { cwd: sandbox.path });
            expect(native.code, native.stdout + native.stderr).toBe(0);
            expect(native.stdout).toBe(
                JSON.stringify(
                    NODE_SCRIPT_CONTRACTS.map(({ file, routine, strict }) => ({
                        file,
                        findings: corrected ? [] : [...routine, ...(level === 'all' ? strict : [])],
                    })),
                ),
            );
        }
    },
);

test.skipIf(process.platform === 'win32').each(NODE_SCRIPT_NATIVE_ROOTS)(
    'native Node glob and output boundaries retain POSIX filenames in %s',
    async (directory) => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, directory);
        const file = String.raw`scripts/run\name`;
        const control = 'scripts/runname';
        await createFileTree(root, {
            'package.json': '{"private":true,"type":"module"}',
            [file]: NODE_SCRIPT_SOURCE,
            [control]: '#!/usr/bin/env bash\necho ready\n',
        });
        const configuration = JSON.stringify([
            {
                files: eslintFilePatterns({ components: [], tests: [], scripts: [], nodeFiles: [file] }).code,
                rules: { 'no-unused-vars': 'error' },
            },
        ]);
        const nativePackage = join(installedModules, 'eslint/package.json');
        const coverage = await runTestCommand(
            ['node', '--input-type=module', '-e', NODE_SCRIPT_PATH_COVERAGE, control, configuration, nativePackage],
            { cwd: root },
        );
        expect(coverage.code, coverage.stdout + coverage.stderr).toBe(0);
        expect(coverage.stdout).toBe('false');
        const command = [
            'node',
            '--input-type=module',
            '-e',
            NODE_SCRIPT_REPORT_SOURCE,
            JSON.stringify([file]),
            configuration,
            nativePackage,
        ];
        const check = configurationManifests()
            .get('javascript')!
            .checks.find(({ name }) => name === 'javascript/eslint')!;
        for (const corrected of [false, true]) {
            if (corrected) await Bun.write(join(root, file), NODE_SCRIPT_CORRECTED);
            const native = await runTestCommand(command, { cwd: root });
            expect(native.code, native.stdout + native.stderr).toBe(0);
            const findings = parseOutput(check, native.stdout, native.stderr, { root, cwd: root });
            expect(findings).toStrictEqual(
                corrected
                    ? []
                    : [
                          {
                              check: check.name,
                              file,
                              line: 2,
                              column: 7,
                              rule: 'no-unused-vars',
                              message: "'unused' is assigned a value but never used.",
                              help: check.help,
                              fixable: false,
                          },
                      ],
            );
        }
        expect(await Bun.file(join(root, control)).text()).toBe('#!/usr/bin/env bash\necho ready\n');
    },
);
