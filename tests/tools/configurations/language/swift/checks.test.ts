// Native Swift lint and formatting checks preserve source headers and pass after explicit fixes.
import { join } from 'node:path';
import { git } from '#tests/harness/git.ts';
import { readFile } from 'node:fs/promises';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { CLEAN_SWIFT } from '#tests/config/samples/swift/source.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { REPOSITORY } from '#tests/config/tools/configurations/language/swift/checks.ts';

const resources = new AsyncDisposableStack();
let testRepository: OwnedTestRepository;
beforeAll(async () => {
    testRepository = resources.use(await createTestRepository(REPOSITORY, spawnGspot));
});
afterAll(async () => {
    await resources.disposeAsync();
});

describe('the swift configuration', () => {
    test('the commit stage leaves the build, the analyzer, and the dead code scan to their own stages', async () => {
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
    });

    test('swiftformat keeps the source header when it fixes spacing', async () => {
        const { root, environment } = testRepository;
        const header = '// Greeting.swift\n// Created by Alex Garcia.\n// Copyright 2026 Example Contributors.\n\n';
        const path = join(root, 'Sources/App/Greeting.swift');
        const restore = await applyChanges(root, {
            check: 'swift/swiftformat',
            files: {
                'Sources/App/Greeting.swift': header + CLEAN_SWIFT.replace('func greeting', 'func   greeting'),
            },
        });
        try {
            const fixed = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--fix'], environment);
            expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
            expect(await readFile(path, 'utf8')).toBe(header + CLEAN_SWIFT);
        } finally {
            await restore();
        }
    });
});
