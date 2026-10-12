import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';
import { DUPLICATE_RULE_CASES, DUPLICATE_RULE_FILES } from '#tests/config/eslint/lint-rules.ts';

test('each pair of duplicate rules reports a defect once, from the kept rule', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...DUPLICATE_RULE_FILES,
        'gspot.toml': settingsText(['typescript'], { level: 'all' }),
        ...Object.fromEntries(DUPLICATE_RULE_CASES.map(({ file, source }) => [file, source])),
    });
    const eslint = await createEslint(sandbox.path);
    for (const { file, rules, kept } of DUPLICATE_RULE_CASES) {
        const reports = await lintFindings(eslint, sandbox.path, [file], rules);
        expect(
            reports.map(({ rule }) => rule),
            file,
        ).toStrictEqual([kept]);
    }
});
