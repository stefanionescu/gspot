import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { createEslint, collectLintFindings } from '#tests/setup/tool-files.ts';

import {
    NESTED_ESLINT_FILES,
    NESTED_ESLINT_PATHS,
    NESTED_ESLINT_RULES,
    WILDCARD_ESLINT_FILES,
} from '#tests/data/generation/eslint/files.ts';

test("a child scope's test_files and script_files get the test and script rule blocks", async () => {
    await using sandbox = await testdir(NESTED_ESLINT_FILES);
    const eslint = await createEslint(sandbox.path);
    expect(await collectLintFindings(eslint, sandbox.path, NESTED_ESLINT_PATHS, NESTED_ESLINT_RULES)).toStrictEqual([
        { file: 'app/source.js', rule: 'no-console', line: 1 },
        { file: 'app/source.js', rule: 'n/no-process-exit', line: 2 },
    ]);
});

test('a child scope wildcard exempts its tests and scripts without exempting sibling code', async () => {
    await using sandbox = await testdir(WILDCARD_ESLINT_FILES);
    const eslint = await createEslint(sandbox.path);
    expect(await collectLintFindings(eslint, sandbox.path, ['app', 'sibling'], ['no-console'])).toStrictEqual([
        { file: 'sibling/build.js', rule: 'no-console', line: 1 },
        { file: 'sibling/read.js', rule: 'no-console', line: 1 },
    ]);
});
