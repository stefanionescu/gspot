import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { REPLACEMENTS } from '#tests/config/cli/planning/replacements.ts';

test.each(REPLACEMENTS)(
    '$check replaces tsc only while the replacing check runs',
    async ({ configuration, check, source, text }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['typescript', configuration]),
            'source.ts': 'export const port = 8080;\n',
            [source]: text,
        });
        const session = await openSession(sandbox.path);
        const options = { stage: 'all' as const, skips: [], only: ['typescript/tsc', check] };
        expect(
            planRun(session, options).find(({ check: entry }) => entry.name === 'typescript/tsc')?.skip,
        ).toStrictEqual({
            cause: 'replaced',
            note: `${check} runs it here`,
        });
        expect(
            planRun(session, { ...options, skips: [check] }).find(({ check: entry }) => entry.name === 'typescript/tsc')
                ?.skip,
        ).toBeUndefined();
        expect(
            planRun(session, { ...options, only: ['typescript/tsc'] }).find(
                ({ check: entry }) => entry.name === 'typescript/tsc',
            )?.skip,
        ).toBeUndefined();
    },
);

test('Vue without TypeScript reports its configuration prerequisite during planning', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['javascript', 'vue']),
        'src/App.vue': '<template><p>App</p></template>',
    });
    expect(
        planRun(await openSession(sandbox.path), { stage: 'all', skips: [], only: ['vue/vue-tsc'] }).map(
            ({ check, skip }) => ({ check: check.name, skip }),
        ),
    ).toStrictEqual([
        {
            check: 'vue/vue-tsc',
            skip: { cause: 'condition', note: 'Needs the typescript configuration, which this scope does not select.' },
        },
    ]);
});
