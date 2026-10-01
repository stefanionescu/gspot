import type { ESLint } from 'eslint';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { textContaining } from '#tests/support/expectations.ts';
import { generatedEslint } from '#tests/support/cli/generated/eslint.ts';
import { VITEST_FILES } from '#tests/inputs/integration/cli/generation/plugin-levels.ts';

async function ruleReports(eslint: ESLint, file: string, rule: string): Promise<{ message: string }[]> {
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
        'gspot.toml': policyOf(
            ['vitest'],
            '[guides]\ninstall = false\n[architecture.roles]\nruntime = ["src/**"]\n[tools.vitest]\nharness_directory = "tests/fixtures"\n',
            'all',
        ),
    });
    const eslint = await generatedEslint(sandbox.path);
    expect(await ruleReports(eslint, 'tests/unit/helpers.js', 'gspot/tests-directory-contents')).toMatchObject([
        { message: textContaining('tests/fixtures') },
    ]);
    expect(await ruleReports(eslint, 'tests/fixtures/helpers.js', 'gspot/tests-directory-contents')).toStrictEqual([]);
    expect(await ruleReports(eslint, 'src/runtime.js', 'gspot/import-direction')).toMatchObject([
        { message: textContaining('Runtime code imports test code') },
    ]);
});

test('without a test runner no folder is the harness, so support files are placed nowhere', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...VITEST_FILES,
        'gspot.toml': policyOf(['javascript'], '[guides]\ninstall = false\n', 'all'),
    });
    const eslint = await generatedEslint(sandbox.path);
    expect(await ruleReports(eslint, 'tests/unit/helpers.js', 'gspot/tests-directory-contents')).toStrictEqual([]);
});
