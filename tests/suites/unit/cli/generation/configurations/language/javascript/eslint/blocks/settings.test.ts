import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

import {
    DUPLICATE_RULE_CASES,
    DUPLICATE_RULE_FILES,
} from '#tests/config/generation/configurations/language/javascript/eslint/blocks/settings.ts';

test.each([...DUPLICATE_RULE_CASES])(
    'each pair of duplicate rules reports a defect once, from the kept rule ($kept)',
    async ({ file, rules, kept }) => {
        await using sandbox = await testdir({
            ...DUPLICATE_RULE_FILES,
            'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
            ...Object.fromEntries(DUPLICATE_RULE_CASES.map(({ file, source }) => [file, source])),
        });

        const eslint = await createEslint(sandbox.path);

        const reports = await listLintFindings(eslint, sandbox.path, [file], rules);
        expect(
            reports.map(({ rule }) => rule),
            file,
        ).toStrictEqual([kept]);
    },
);

test('a missing scope with rule options leaves apply usable and unmatched paths reports the typo', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: '[[scope]]\npath = "missing"\ntools.eslint.rules = { eqeqeq = ["always"] }\n',
        }),
        'source.js': 'export const ready = true;\n',
    });
    await createEslint(sandbox.path);
    expect(await runSandboxCheck(sandbox.path, 'gspot/unmatched-paths')).toMatchObject([
        { file: 'gspot.toml', message: 'missing under scope.0.path matches no tracked file or folder.' },
    ]);
});
