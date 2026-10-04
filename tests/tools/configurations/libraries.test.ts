// Test repository for the library configurations: each ESLint addition fires on a small component.
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { test, afterAll, describe, beforeAll } from 'bun:test';
import { expectCheckCase } from '#tests/harness/expectations.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { COMPONENT_SOURCE } from '#tests/config/samples/components.ts';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import { CASES, REPOSITORY } from '#tests/config/tools/configurations/libraries.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';

describe('the library configurations', () => {
    const repository: RepositoryScenario = {
        ...REPOSITORY,
        corrected: (entry) => ({
            files: Object.fromEntries(Object.keys(entry.files).map((path) => [path, COMPONENT_SOURCE])),
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
    for (const entry of CASES) {
        const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
        const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
        test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker()))(
            `${entry.check} reports ${where} and accepts the correction`,
            async () => {
                await expectCheckCase(testRepository, entry, repository);
            },
            suiteTimeout(),
        );
    }
});
