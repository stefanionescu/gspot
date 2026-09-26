import type { ESLint } from 'eslint';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { textContaining } from '#tests/support/expectations.ts';
import { generatedEslint } from '#tests/support/cli/generated-eslint.ts';
import { VITEST_FILES } from '#tests/constants/integration/cli/generation/plugin-levels.ts';

async function ruleReports(eslint: ESLint, file: string, rule: string): Promise<{ message: string }[]> {
    const results = await eslint.lintFiles([file]);
    return results
        .flatMap((result) => result.messages)
        .filter(({ ruleId, fatal }) => ruleId === rule || fatal)
        .map(({ message }) => ({ message }));
}

test('the Vitest harness folder places test support and closes it to runtime code', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...VITEST_FILES,
        'gspot.toml':
            'version = 1\nlevel = "all"\nconfigurations = ["vitest"]\n[rules]\ninstall = false\n[tools.vitest]\nharness_directory = "tests/fixtures"\n',
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
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["javascript"]\n[rules]\ninstall = false\n',
    });
    const eslint = await generatedEslint(sandbox.path);
    expect(await ruleReports(eslint, 'tests/unit/helpers.js', 'gspot/tests-directory-contents')).toStrictEqual([]);
});
