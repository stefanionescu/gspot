import { test, expect } from 'bun:test';
import type { ESLint, Linter } from 'eslint';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { APP_JEST } from '#tests/config/cli/generation/eslint/jest.ts';
import { VITEST_FILES } from '#tests/config/cli/generation/eslint/vitest.ts';
import type { ComputedEslint } from '#tests/types/cli/generation/configuration-files.ts';

async function ruleReports(eslint: ESLint, file: string, rule: string): Promise<Pick<Linter.LintMessage, 'message'>[]> {
    const results = await eslint.lintFiles([file]);
    return results
        .flatMap((result) => result.messages)
        .filter(({ ruleId, fatal }) => ruleId === rule || fatal)
        .map(({ message: text }) => ({ message: text }));
}

test.each(['jest', 'vitest'])('%s closes test support to runtime code in its scope', async (configuration) => {
    const prefix = configuration === 'jest' ? 'app/' : '';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...Object.fromEntries(
            Object.entries(VITEST_FILES).map(([path, content]) => [
                path === 'package.json' ? path : prefix + path,
                content,
            ]),
        ),
        'gspot.toml':
            configuration === 'jest'
                ? APP_JEST
                : buildPolicy(['vitest'], {
                      tables: '[agent_rules]\nenabled = false\n[architecture.roles]\nruntime = ["src/**"]\ntest_harness = "tests/fixtures"\n',
                      level: 'all',
                  }),
    });
    const eslint = await createEslint(sandbox.path);
    expect(await ruleReports(eslint, `${prefix}src/runtime.js`, 'boundaries/dependencies')).toMatchObject([
        { message: textContaining('test_harness') },
    ]);
});

test('Vitest rules apply without a harness role', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...VITEST_FILES,
        'gspot.toml': buildPolicy(['vitest'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' }),
    });
    const eslint = await createEslint(sandbox.path);
    const config = (await eslint.calculateConfigForFile('tests/unit/example.test.js')) as Linter.Config;
    expect((config.rules!['vitest/no-focused-tests'] as unknown[])[0]).toBe(2);
});

test.each(['recommended', 'all'] as const)(
    '%s Vitest retains required test rules and all-only strict equality',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...VITEST_FILES,
            'gspot.toml': buildPolicy(['vitest'], { level, tables: '[agent_rules]\nenabled = false\n' }),
        });
        const eslint = await createEslint(sandbox.path);
        const config = (await eslint.calculateConfigForFile('tests/unit/example.test.js')) as ComputedEslint;
        expect(config.rules['vitest/no-focused-tests']).toStrictEqual([2, { fixable: false }]);
        expect(config.rules['vitest/valid-expect']![0]).toBe(2);
        expect(config.rules['vitest/prefer-strict-equal']?.[0] ?? 0).toBe(level === 'all' ? 2 : 0);
        const results = await eslint.lintText(
            `import { test, expect } from 'vitest';
test.only('checks the value', () => { expect({value: 1}).toEqual({value: 1}); });
`,
            { filePath: 'tests/unit/example.test.js' },
        );
        expect(
            results
                .flatMap((result) => result.messages)
                .filter(({ ruleId }) => ruleId === 'vitest/no-focused-tests')
                .map(({ fix }) => fix),
        ).toStrictEqual([undefined]);
        expect(
            results
                .flatMap((result) => result.messages)
                .filter(({ ruleId }) => ruleId === 'vitest/prefer-strict-equal'),
        ).toHaveLength(level === 'all' ? 1 : 0);
    },
);
