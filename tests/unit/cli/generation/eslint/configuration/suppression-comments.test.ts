import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';
import { SUPPRESSION_FIXED, SUPPRESSION_FILES } from '#tests/config/eslint/levels.ts';

test('an unused eslint-disable comment is reported', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...SUPPRESSION_FILES,
        'gspot.toml': settingsText(['javascript'], { level: 'all' }),
    });
    const eslint = await createEslint(sandbox.path);
    expect(await lintFindings(eslint, sandbox.path, ['unused.js'], [])).toStrictEqual([
        { file: 'unused.js', rule: null, line: 1 },
    ]);
    await createFileTree(sandbox.path, SUPPRESSION_FIXED);
    expect(await lintFindings(eslint, sandbox.path, ['unused.js'], [])).toStrictEqual([]);
});
