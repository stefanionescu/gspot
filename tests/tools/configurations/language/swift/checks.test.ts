// Native Swift lint and formatting checks preserve source headers and accept explicit corrections.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { git } from '#tests/harness/git.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { containing } from '#tests/harness/expectations.ts';
import { CLEAN_SWIFT } from '#tests/config/samples/swift.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { CASES, SPACED, REPOSITORY } from '#tests/config/tools/configurations/language/swift/checks.ts';

const repository: RepositoryScenario = {
    ...REPOSITORY,
    corrected: (entry) => ({
        files: Object.fromEntries(
            Object.keys(entry.files).map((path, index) => [
                path,
                CLEAN_SWIFT.replaceAll('greeting', index === 0 ? 'greetPerson' : 'greetVisitor').replaceAll(
                    'hello',
                    `welcome ${String(index)}`,
                ),
            ]),
        ),
    }),
};
const resources = new AsyncDisposableStack();
let testRepository: OwnedTestRepository;
beforeAll(async () => {
    const budget = openTestBudget(suiteTimeout());
    try {
        testRepository = resources.use(await createTestRepository(repository, spawnGspot));
    } finally {
        budget[Symbol.dispose]();
    }
}, suiteTimeout());
afterAll(async () => {
    await resources.disposeAsync();
});

describe('the swift configuration', () => {
    for (const entry of CASES) {
        const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
        const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
        test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker()))(
            `${entry.check} reports ${where} and accepts the correction`,
            async () => {
                const { failed: outcome, passed: correction } = await runFindingCase(testRepository, entry, repository);
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

    test(
        'the commit stage leaves the build, the analyzer, and the dead code scan to their own stages',
        async () => {
            const { root, environment } = testRepository;
            expect(git(root, ['add', '-A']).code).toBe(0);
            const command = ['check', '--hook', 'pre-commit', '--only'];
            const checks = ['swift/swiftlint', 'swift/build', 'swift/swiftlint-analyze', 'swift/periphery'];
            const checked = await spawnGspot(root, [...command, ...checks, '--json'], environment);
            expect(checked.code, checked.stdout + checked.stderr).toBe(0);
            const ids = (JSON.parse(checked.stdout) as RunReport).checks.map((check) => check.check);
            expect(ids).toContain('swift/swiftlint');
            expect(ids).not.toContain('swift/build');
            expect(ids).not.toContain('swift/swiftlint-analyze');
            expect(ids).not.toContain('swift/periphery');
        },
        NATIVE_TEST_TIMEOUT_MS,
    );

    test(
        'swiftformat keeps the source header when it fixes spacing',
        async () => {
            const { root, environment } = testRepository;
            const header = '// Greeting.swift\n// Created by Alex Garcia.\n// Copyright 2026 Example Contributors.\n\n';
            const path = join(root, 'Sources/App/Greeting.swift');
            const restore = applyChanges(root, {
                check: 'swift/swiftformat',
                files: { 'Sources/App/Greeting.swift': header + SPACED },
            });
            try {
                const fixed = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--fix'], environment);
                expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
                expect(readFileSync(path, 'utf8')).toBe(header + CLEAN_SWIFT);
            } finally {
                restore();
            }
        },
        NATIVE_TEST_TIMEOUT_MS,
    );
});
