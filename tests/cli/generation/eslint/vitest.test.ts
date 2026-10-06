import { test, expect } from 'bun:test';
import type { ESLint, Linter } from 'eslint';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { VITEST_FILES } from '#tests/config/cli/generation/eslint/vitest.ts';

async function ruleReports(eslint: ESLint, file: string, rule: string): Promise<Pick<Linter.LintMessage, 'message'>[]> {
    const results = await eslint.lintFiles([file]);
    return results
        .flatMap((result) => result.messages)
        .filter(({ ruleId, fatal }) => ruleId === rule || fatal)
        .map(({ message: text }) => ({ message: text }));
}

test('the Vitest harness folder places test support and closes it to runtime code', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...VITEST_FILES,
        'gspot.toml': buildPolicy(['vitest'], {
            tables: '[agent_rules]\nenabled = false\n[architecture.roles]\nruntime = ["src/**"]\ntest_support = "tests/fixtures"\n',
            level: 'all',
        }),
    });
    const eslint = await createEslint(sandbox.path);
    expect(await ruleReports(eslint, 'tests/unit/helpers.js', 'gspot/no-helpers-beside-tests')).toMatchObject([
        { message: textContaining('tests/fixtures') },
    ]);
    expect(await ruleReports(eslint, 'tests/fixtures/helpers.js', 'gspot/no-helpers-beside-tests')).toStrictEqual([]);
    expect(await ruleReports(eslint, 'src/runtime.js', 'gspot/import-direction')).toMatchObject([
        { message: textContaining('Runtime code imports test code') },
    ]);
});

test('without a harness role no folder is the harness, so support files are placed nowhere', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...VITEST_FILES,
        'gspot.toml': buildPolicy(['javascript'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' }),
    });
    const eslint = await createEslint(sandbox.path);
    expect(await ruleReports(eslint, 'tests/unit/helpers.js', 'gspot/no-helpers-beside-tests')).toStrictEqual([]);
});
