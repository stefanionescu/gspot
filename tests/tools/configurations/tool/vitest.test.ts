import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runCheckCommand } from '#cli/execution/command/public.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import vitestManifest from 'vitest/package.json' with { type: 'json' };

import {
    UNTESTED,
    REPOSITORY,
    VITEST_SOURCE,
    VITEST_PACKAGE,
    PROVIDER_FLOORS,
} from '#tests/config/tools/configurations/tool/vitest.ts';

const files = {
    ...REPOSITORY.files,
    'package.json': JSON.stringify({ ...VITEST_PACKAGE, devDependencies: { vitest: vitestManifest.version } }) + '\n',
};

test.each(['recommended', 'all'] as const)(
    'native Vitest reports a threshold and its fix in root and child scopes at %s',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, files);
        await createFileTree(join(sandbox.path, 'app'), files);
        await linkInstalledModules(join(sandbox.path, 'node_modules'));
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            buildPolicy(['typescript', 'vitest'], {
                level,
                tables: '[coverage]\nlines = 100\nfunctions = 100\n[scope."app"]\nconfigurations = ["typescript", "vitest"]\n',
            }),
        );
        for (const scope of ['', 'app']) {
            const source = join(sandbox.path, scope, 'src/public.ts');
            await Bun.write(source, UNTESTED);
            let session = await openSession(sandbox.path);
            let planned = planRun(session, { stage: 'push', skips: [], only: ['vitest/coverage'] }).find(
                (entry) => entry.scope.scope.path === scope,
            );
            if (planned === undefined) throw new Error('The native Vitest check was not planned.');
            const failed = await runCheckCommand(session, planned);
            expect(failed.status).toBe('failed');
            expect(failed.findings.some((finding) => finding.message.includes('100%'))).toBe(true);
            expect(await Bun.file(source).text()).toBe(UNTESTED);
            await Bun.write(source, VITEST_SOURCE);
            session = await openSession(sandbox.path);
            planned = planRun(session, { stage: 'push', skips: [], only: ['vitest/coverage'] }).find(
                (entry) => entry.scope.scope.path === scope,
            );
            if (planned === undefined) throw new Error('The corrected native Vitest check was not planned.');
            const corrected = await runCheckCommand(session, planned);
            expect(corrected.status).toBe('passed');
            expect(await Bun.file(source).text()).toBe(VITEST_SOURCE);
        }
    },
);

test.each([...PROVIDER_FLOORS])(
    'native Vitest at %s runs with a %i floor without its provider',
    async (level, floor) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, files);
        await createFileTree(join(sandbox.path, 'app'), files);
        await linkInstalledModules(join(sandbox.path, 'node_modules'));
        await rm(join(sandbox.path, 'node_modules/@vitest/coverage-v8'));
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            buildPolicy(['typescript', 'vitest'], {
                level,
                tables: `[coverage]\nlines = ${String(floor)}\nbranches = 0\nfunctions = 0\nstatements = 0\n[reasons]\n"coverage.lines" = "This fixture checks optional coverage."\n"coverage.branches" = "This fixture checks optional coverage."\n"coverage.functions" = "This fixture checks optional coverage."\n"coverage.statements" = "This fixture checks optional coverage."\n[scope."app"]\nconfigurations = ["typescript", "vitest"]\n`,
            }),
        );
        const session = await openSession(sandbox.path);
        const checks = planRun(session, { stage: 'push', skips: [], only: ['vitest/coverage'] });
        expect(checks.map((check) => check.scope.scope.path)).toStrictEqual(['', 'app']);
        for (const check of checks) {
            const outcome = await runCheckCommand(session, check);
            expect(outcome.status).toBe(floor === 0 ? 'passed' : 'missing');
            if (floor === 0) expect(outcome.command?.some((arg) => arg.startsWith('--coverage'))).toBe(false);
            else expect(outcome.note).toContain('@vitest/coverage-v8');
        }
    },
);
