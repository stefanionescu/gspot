// Native Swift lint and formatting checks preserve source headers and accept explicit corrections.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { git } from '#tests/harness/git.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { CLEAN_SWIFT } from '#tests/config/samples/swift.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { SPACED, REPOSITORY } from '#tests/config/tools/configurations/language/swift/checks.ts';

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

describe('the swift configuration', () => {
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
