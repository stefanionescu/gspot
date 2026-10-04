// An OpenAPI operation without its identifier reports the Spectral rule.
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { test, afterAll, describe, beforeAll } from 'bun:test';
import { expectCheckCase } from '#tests/harness/expectations.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import { CASES, DOCUMENT, REPOSITORY } from '#tests/config/tools/configurations/tool/openapi.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';

describe('the openapi configuration', () => {
    const repository: RepositoryScenario = {
        ...REPOSITORY,
        files: {
            ...REPOSITORY.files,
            'write-document.js': `await Bun.write('openapi.yaml', ${JSON.stringify(DOCUMENT)});\n`,
        },
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
