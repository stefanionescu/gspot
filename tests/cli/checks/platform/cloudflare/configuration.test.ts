// The built-in Cloudflare checks on a test site, run in-process: each fires on its defect and accepts the correction.
import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { runGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { test, afterAll, describe, beforeAll } from 'bun:test';
import { expectCheckCase } from '#tests/harness/expectations.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { CASES, REPOSITORY } from '#tests/config/cli/checks/platform/cloudflare/configuration.ts';

// A wrangler that answers its version and writes one fixed types file; the real one needs a Cloudflare account.

describe('the cloudflare configuration', () => {
    const repository: RepositoryScenario = {
        ...REPOSITORY,
        before: (root) => {
            chmodSync(join(root, 'node_modules/.bin/wrangler'), 0o755);
        },
    };
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            testRepository = resources.use(await createTestRepository(repository, runGspot));
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
