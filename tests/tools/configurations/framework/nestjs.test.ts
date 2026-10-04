// A clean NestJS module passes every check, and the NestJS plugin reports a route parameter its decorator does not name.
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { expectCheckCase } from '#tests/harness/expectations.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { CASES, REPOSITORY } from '#tests/config/tools/configurations/framework/nestjs.ts';

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
                await expectCheckCase(testRepository, entry, REPOSITORY);
            },
            suiteTimeout(),
        );
    }

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
