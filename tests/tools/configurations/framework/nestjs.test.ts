// A clean NestJS module passes every check, and the NestJS plugin reports a route parameter its decorator does not name.
import { join } from 'node:path';
import { spawnGspot } from '#tests/harness/gspot.ts';
import type { Level } from '#cli/types/configurations.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import type { PackageManifest } from '#cli/types/parsers/packages.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { CASES, REPOSITORY, SWAGGER_DEPENDENCY } from '#tests/config/tools/configurations/framework/nestjs.ts';

// Declaring an API documentation dependency makes its native lint contract applicable.
async function swaggerContracts(repository: OwnedTestRepository, level: Level): Promise<void> {
    const { root, environment } = repository;
    const packagePath = join(root, 'package.json');
    const policyPath = join(root, 'gspot.toml');
    const original = await Bun.file(packagePath).text();
    const policy = await Bun.file(policyPath).text();
    const manifest = JSON.parse(original) as PackageManifest;
    try {
        const selected = await spawnGspot(root, ['set', 'level', level], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        await Bun.write(
            packagePath,
            JSON.stringify({
                ...manifest,
                dependencies: { ...manifest.dependencies, '@nestjs/swagger': SWAGGER_DEPENDENCY },
            }),
        );
        const applied = await spawnGspot(root, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const failed = await spawnGspot(root, ['check', '--only', 'javascript/eslint', '--json'], environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks.flatMap((check) => check.findings)).toContainEqual(
            containing({
                file: 'src/greeting.controller.ts',
                rule: '@darraghor/nestjs-typed/controllers-should-supply-api-tags',
                line: 7,
            }),
        );
        await Bun.write(packagePath, original);
        const restored = await spawnGspot(root, ['apply'], environment);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        const accepted = await spawnGspot(root, ['check', '--only', 'javascript/eslint', '--json'], environment);
        expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
        expect((JSON.parse(accepted.stdout) as RunReport).checks).toMatchObject([
            { check: 'javascript/eslint', status: 'passed', findings: [] },
        ]);
    } finally {
        await Bun.write(packagePath, original);
        await Bun.write(policyPath, policy);
        await spawnGspot(root, ['apply'], environment);
    }
}

describe('the nestjs configuration', () => {
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            testRepository = resources.use(await createTestRepository(REPOSITORY, spawnGspot));
        } finally {
            budget[Symbol.dispose]();
        }
    }, suiteTimeout());
    afterAll(async () => {
        await resources.disposeAsync();
    });
    for (const entry of CASES) {
        const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
        const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
        test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker()))(
            `${entry.check} reports ${where} and accepts the correction`,
            async () => {
                const { failed: outcome, passed: correction } = await runFindingCase(testRepository, entry, REPOSITORY);
                expect(outcome.code, `${entry.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
                expect(outcome.report.checks[0]?.findings).toContainEqual(
                    containing({ check: entry.check, ...entry.expected }),
                );
                expect(correction.code, `${entry.check} corrected: ${correction.stdout}${correction.stderr}`).toBe(0);
                expect(correction.report.checks).toMatchObject([
                    { check: entry.check, status: 'passed', findings: [] },
                ]);
            },
            suiteTimeout(),
        );
    }

    test.each(['recommended', 'all'] as const)(
        '%s enforces Swagger contracts only when the project declares Swagger',
        (level) => swaggerContracts(testRepository, level),
        NATIVE_TEST_TIMEOUT_MS,
    );

    test(
        'the lint, type, and compiler option checks accept the clean Nest module',
        async () => {
            const { root, environment } = testRepository;
            for (const id of ['javascript/eslint', 'typescript/tsc', 'typescript/tsconfig']) {
                const clean = await spawnGspot(root, ['check', '--only', id], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
        },
        NATIVE_TEST_TIMEOUT_MS,
    );
});
