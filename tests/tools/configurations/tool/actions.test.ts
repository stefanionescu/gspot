// Test repository for the actions configuration: a workflow with an unknown expression context and one open to template injection.
import { join } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { expectCheckCase } from '#tests/harness/expectations.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { install, buildToolsPath } from '#tests/harness/install.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { suiteTimeout, openTestBudget, runTestCommand } from '#tests/harness/command.ts';
import { CASES, REPOSITORY, ACTIONS_INIT } from '#tests/config/tools/configurations/tool/actions.ts';

describe('the actions configuration', () => {
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
});

test(
    'the actions configuration: GitHub initialization writes a workflow accepted by actionlint',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# Workflow test\n' });
        commitAll(sandbox.path);
        const environment = { PATH: buildToolsPath(['actionlint']) };
        await install(sandbox.path, [...ACTIONS_INIT, '--ci', 'github', '--no-hooks'], environment);
        const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, '.github/workflows/gspot.yml')).exists()).toBe(true);
        const result = await runTestCommand(['actionlint', '-no-color', '.github/workflows/gspot.yml'], {
            cwd: sandbox.path,
            env: environment,
        });
        expect(result.code, result.stderr + result.stdout).toBe(0);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
