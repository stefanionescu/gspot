// The generated configuration retains the complete pinned TanStack preset and its typed behavior.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import queryPlugin from '@tanstack/eslint-plugin-query';
import { createEslint } from '#tests/harness/generated.ts';
import type { ResolvedEslint } from '#tests/types/generation/configuration-files.ts';
import { QUERY_DEFECT, QUERY_PROJECT, QUERY_CORRECTION } from '#tests/config/cli/generation/eslint/tanstack-query.ts';

test.each(['recommended', 'all'] as const)(
    '%s TanStack rules report void queries and callback order and accept corrections',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...QUERY_PROJECT,
            'gspot.toml': buildPolicy(['typescript', 'tanstack-query'], {
                level: level,
                tables: '[agent_rules]\nenabled = false\n',
            }),
            'src/query.ts': QUERY_DEFECT,
        });
        const eslint = await createEslint(sandbox.path);
        const config = (await eslint.calculateConfigForFile('src/query.ts')) as ResolvedEslint;
        for (const block of queryPlugin.configs['flat/recommended'])
            for (const name of Object.keys(block.rules)) expect(config.rules[name]?.[0]).toBe(2);
        const before = await eslint.lintFiles(['src/query.ts', 'src/neighbor.ts']);
        expect(before.flatMap(({ messages }) => messages.filter(({ fatal }) => fatal === true))).toStrictEqual([]);
        expect(
            before.flatMap(({ messages }) =>
                messages
                    .filter(({ ruleId }) => ruleId?.startsWith('@tanstack/query/') === true)
                    .map(({ ruleId, line }) => ({ ruleId, line })),
            ),
        ).toStrictEqual([
            { ruleId: '@tanstack/query/no-void-query-fn', line: 2 },
            { ruleId: '@tanstack/query/mutation-property-order', line: 3 },
        ]);
        await Bun.write(`${sandbox.path}/src/query.ts`, QUERY_CORRECTION);
        const after = await eslint.lintFiles(['src/query.ts', 'src/neighbor.ts']);
        expect(
            after.flatMap(({ messages }) =>
                messages.filter(
                    ({ ruleId, fatal }) => fatal === true || ruleId?.startsWith('@tanstack/query/') === true,
                ),
            ),
        ).toStrictEqual([]);
        expect(await Bun.file(`${sandbox.path}/src/neighbor.ts`).text()).toBe(QUERY_PROJECT['src/neighbor.ts']);
    },
);
