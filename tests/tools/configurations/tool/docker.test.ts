// Test repository for the docker configuration: a careless Dockerfile, a missing ignore file, and a container that runs as root.
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { test, afterAll, describe, beforeAll } from 'bun:test';
import { createTestRepository } from '#tests/harness/repository.ts';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { textContaining, expectCheckCase } from '#tests/harness/expectations.ts';
import { CASES, REPOSITORY } from '#tests/config/tools/configurations/tool/docker.ts';

describe('the docker configuration', () => {
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
    for (const entry of CASES.map((value) =>
        value.check === 'docker/compose'
            ? { ...value, expected: { ...value.expected, message: textContaining('bogus') } }
            : value,
    )) {
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
});
