import type { ESLint } from 'eslint';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { generatedEslint } from '#tests/harness/cli/generated.ts';

const VITEST_FILES = {
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
        .map(({ message: text }) => ({ message: text }));
}

test('the Vitest harness folder places test support and closes it to runtime code', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...VITEST_FILES,
        'gspot.toml': policyOf(
            ['vitest'],
            '[rules]\ninstall = false\n[architecture.roles]\nruntime = ["src/**"]\nharness = "tests/fixtures"\n',
            'all',
        ),
    });
    const eslint = await generatedEslint(sandbox.path);
    expect(await ruleReports(eslint, 'tests/unit/helpers.js', 'gspot/test-folders')).toMatchObject([
        { message: textContaining('tests/fixtures') },
    ]);
    expect(await ruleReports(eslint, 'tests/fixtures/helpers.js', 'gspot/test-folders')).toStrictEqual([]);
    expect(await ruleReports(eslint, 'src/runtime.js', 'gspot/import-direction')).toMatchObject([
        { message: textContaining('Runtime code imports test code') },
    ]);
});

test('without a harness role no folder is the harness, so support files are placed nowhere', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...VITEST_FILES,
        'gspot.toml': policyOf(['javascript'], '[rules]\ninstall = false\n', 'all'),
    });
    const eslint = await generatedEslint(sandbox.path);
    expect(await ruleReports(eslint, 'tests/unit/helpers.js', 'gspot/test-folders')).toStrictEqual([]);
});
