import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';

import {
    ENGINE_PATHS,
    ENGINE_PHASES,
    ENGINE_SOURCE,
    ENGINE_FINDINGS,
    ENGINE_PACKAGES,
} from '#tests/config/eslint/engines.ts';

test('native Node checks follow package engines', async () => {
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
    for (const phase of ENGINE_PHASES) {
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            settingsText(['javascript'], { level: 'all', tables: phase.tables }),
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
        const findings = await lintFindings(
            eslint,
            sandbox.path,
            ENGINE_PATHS,
            ENGINE_FINDINGS.map(({ ruleId }) => ruleId),
        );
        expect(findings.toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual(
            ENGINE_PATHS.toSorted((left, right) => left.localeCompare(right)).flatMap((file) =>
                new Set<string>(phase.reported).has(file)
                    ? ENGINE_FINDINGS.map(({ ruleId, line }) => ({ file, rule: ruleId, line }))
                    : [],
            ),
        );
    }
});
