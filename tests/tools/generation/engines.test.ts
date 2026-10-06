import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { runTestCommand } from '#tests/harness/command.ts';

import {
    ENGINE_PATHS,
    ENGINE_PHASES,
    ENGINE_SOURCE,
    ENGINE_FINDINGS,
    ENGINE_PACKAGES,
    ENGINE_LINT_SOURCE,
} from '#tests/config/tools/generation/engines.ts';

test.each(['recommended', 'all'] as const)(
    '%s native Node checks follow package engines and scoped authored overrides',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...ENGINE_PACKAGES,
            ...Object.fromEntries(
                ENGINE_PATHS.map((path) => [
                    path,
                    path.endsWith('.cjs')
                        ? ENGINE_SOURCE.replace('export const grouped =', 'exports.grouped =')
                        : ENGINE_SOURCE,
                ]),
            ),
        });
        const command = ['node', '--input-type=module', '-e', ENGINE_LINT_SOURCE, JSON.stringify(ENGINE_PATHS)];
        for (const phase of ENGINE_PHASES) {
            await Bun.write(
                join(sandbox.path, 'gspot.toml'),
                buildPolicy(['javascript'], { level, tables: phase.tables }),
            );
            for (const path of phase.corrections) {
                const source = await Bun.file(join(sandbox.path, path)).text();
                await Bun.write(
                    join(sandbox.path, path),
                    source
                        .replace('Object.groupBy([1], String)', 'Object.fromEntries([["group", [1]]])')
                        .replace('process.loadEnvFile()', 'process.cwd()'),
                );
            }
            await createEslint(sandbox.path);
            const native = await runTestCommand(command, { cwd: sandbox.path });
            expect(native.code, native.stdout + native.stderr).toBe(0);
            expect(native.stdout).toBe(
                JSON.stringify(
                    ENGINE_PATHS.toSorted((left, right) => left.localeCompare(right)).map((file) => ({
                        file,
                        findings: phase.reported.includes(file) ? ENGINE_FINDINGS : [],
                    })),
                ),
            );
        }
        for (const [path, content] of Object.entries(ENGINE_PACKAGES))
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe(content);
    },
);
