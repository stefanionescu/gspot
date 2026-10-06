import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { runTestCommand } from '#tests/harness/command.ts';

import {
    NODE_SCRIPT_FILES,
    NODE_SCRIPT_PATHS,
    NODE_SCRIPT_TABLES,
    NODE_SCRIPT_CONTROLS,
    NODE_SCRIPT_CONTRACTS,
    NODE_SCRIPT_CORRECTED,
    NODE_SCRIPT_LINT_SOURCE,
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
