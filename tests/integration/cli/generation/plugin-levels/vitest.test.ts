import type { ESLint } from 'eslint';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { generatedEslint } from '#tests/support/cli/generated-eslint.ts';

const FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tests/fixtures/helpers.js': 'export const value = 1;\n',
    'tests/fixtures/example.test.js': '',
    'tests/unit/helpers.js': 'export const value = 1;\n',
    'tests/unit/example.test.js': '',
    'src/runtime.js': 'import { value } from "../tests/fixtures/helpers.js"; export const result = value + 1;\n',
};

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
        ...FILES,
        'gspot.toml':
            'version = 1\nlevel = "all"\nconfigurations = ["vitest"]\n[rules]\ninstall = false\n[tools.vitest]\nharness_directory = "tests/fixtures"\n',
    });
    const eslint = await generatedEslint(sandbox.path);
    expect(await ruleReports(eslint, 'tests/unit/helpers.js', 'gspot/tests-directory-contents')).toMatchObject([
        { message: expect.stringContaining('tests/fixtures') },
    ]);
    expect(await ruleReports(eslint, 'tests/fixtures/helpers.js', 'gspot/tests-directory-contents')).toStrictEqual([]);
    expect(await ruleReports(eslint, 'src/runtime.js', 'gspot/import-direction')).toMatchObject([
        { message: expect.stringContaining('Runtime code imports test code') },
    ]);
});

test('without a test runner no folder is the harness, so support files are placed nowhere', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...FILES,
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["javascript"]\n[rules]\ninstall = false\n',
    });
    const eslint = await generatedEslint(sandbox.path);
    expect(await ruleReports(eslint, 'tests/unit/helpers.js', 'gspot/tests-directory-contents')).toStrictEqual([]);
});
