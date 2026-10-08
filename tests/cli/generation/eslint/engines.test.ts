import { test, expect } from 'bun:test';
import { join, relative } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import type { EnginePhase } from '#tests/types/cli/generation/eslint/engines.ts';

import {
    ENGINE_PATHS,
    ENGINE_PHASES,
    ENGINE_SOURCE,
    ENGINE_FINDINGS,
    ENGINE_PACKAGES,
} from '#tests/config/cli/generation/eslint/engines.ts';

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
        const phases: EnginePhase[] = ENGINE_PHASES;
        for (const phase of phases) {
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
            const eslint = await createEslint(sandbox.path);
            const results = await eslint.lintFiles(ENGINE_PATHS);
            const native = results
                .map(({ filePath, messages }) => ({
                    file: toPosix(relative(sandbox.path, filePath)),
                    findings: messages
                        .filter(
                            ({ ruleId, fatal }) =>
                                ruleId === 'n/no-unsupported-features/es-builtins' ||
                                ruleId === 'n/no-unsupported-features/node-builtins' ||
                                fatal,
                        )
                        .map(({ ruleId, line, severity }) => ({ ruleId, line, severity })),
                }))
                .toSorted((left, right) => left.file.localeCompare(right.file));
            expect(JSON.stringify(native)).toBe(
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
