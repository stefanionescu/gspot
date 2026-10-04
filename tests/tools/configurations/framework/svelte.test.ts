// One installed Svelte repository: the shared rules inside component scripts, svelte-check, the style block, the
// takeover of tsc, and Prettier through the Svelte plugin.
import { join } from 'node:path';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import { containing, expectCheckCase } from '#tests/harness/expectations.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { CASES, REPOSITORY, SVELTE_CLEAN } from '#tests/config/tools/configurations/framework/svelte.ts';

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

describe('the svelte configuration', () => {
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
        'svelte/check takes over typescript/tsc',
        async () => {
            const { root, environment } = testRepository;
            const both = await spawnGspot(
                root,
                ['check', '--json', '--only', 'typescript/tsc', 'svelte/check'],
                environment,
            );
            expect(both.code, both.stdout + both.stderr).toBe(0);
            expect((JSON.parse(both.stdout) as RunReport).checks).toContainEqual(
                containing({ check: 'typescript/tsc', status: 'skipped', note: 'svelte/check runs it here' }),
            );
        },
        NATIVE_TEST_TIMEOUT_MS,
    );

    test(
        'format/prettier reports and corrects a component through the Svelte plugin',
        async () => {
            const { root, environment } = testRepository;
            const path = join(root, 'src/Greeting.svelte');
            const restore = applyChanges(root, {
                check: 'format/prettier',
                files: { 'src/Greeting.svelte': SVELTE_CLEAN.replace('<p>', '<p     >') },
            });
            try {
                const loose = await spawnGspot(root, ['check', '--only', 'format/prettier', '--json'], environment);
                expect(loose.code, loose.stdout + loose.stderr).toBe(1);
                expect((JSON.parse(loose.stdout) as RunReport).checks[0]!.findings).toContainEqual(
                    containing({ file: 'src/Greeting.svelte' }),
                );
                const fixed = await spawnGspot(root, ['check', '--fix', '--only', 'format/prettier'], environment);
                expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
                expect(await Bun.file(path).text()).toBe(SVELTE_CLEAN);
            } finally {
                restore();
            }
        },
        NATIVE_TEST_TIMEOUT_MS,
    );
});
