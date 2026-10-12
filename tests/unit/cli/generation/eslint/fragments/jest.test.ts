import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { APP_JEST } from '#tests/config/eslint/fragments.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';

test.each(['js', 'jsx'])('Jest rules apply only to their scope for .%s files', async (extension) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': APP_JEST,
        'package.json': '{"private":true,"type":"module"}\n',
        'root.test.js': '',
        'app/sample.test.js': '',
    });
    const eslint = await createEslint(sandbox.path);
    const focused =
        "import { test, expect } from '@jest/globals';\ntest.only('counts', () => { expect(1).toBe(1); });\n";
    const root = `root.test.${extension}`;
    const nested = `app/sample.test.${extension}`;
    await createFileTree(sandbox.path, { [root]: focused, [nested]: focused });
    expect(await lintFindings(eslint, sandbox.path, [root], ['jest/no-focused-tests'])).toStrictEqual([]);
    expect(await lintFindings(eslint, sandbox.path, [nested], ['jest/no-focused-tests'])).toStrictEqual([
        { file: nested, rule: 'jest/no-focused-tests', line: 2 },
    ]);
});
