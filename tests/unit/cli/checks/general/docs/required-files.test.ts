import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { README, LICENSE } from '#tests/config/docs.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { checkFindings } from '#tests/setup/check-input.ts';

test('a root without LICENSE is reported and passes once LICENSE exists', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['docs'], { level: 'all' }),
        'README.md': README,
    });
    const failed = await checkReport(sandbox.path, ['check', '--only', 'docs/required-files', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks).toMatchObject([
        {
            check: 'docs/required-files',
            status: 'failed',
            findings: [{ file: 'LICENSE', message: 'The root has no LICENSE file.' }],
        },
    ]);
    await Bun.write(join(sandbox.path, 'LICENSE'), LICENSE);
    const corrected = await checkReport(sandbox.path, ['check', '--only', 'docs/required-files', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test.each(['COPYING', 'LICENCE', 'LICENSE-MIT', 'LICENSE.rst'])(
    'the license file %s counts as a LICENSE',
    async (name) => {
        await using sandbox = await testdir({
            'gspot.toml': settingsText(['docs'], { level: 'all' }),
            'README.md': README,
            [name]: LICENSE,
        });
        expect(await checkFindings(sandbox.path, 'docs/required-files')).toStrictEqual([]);
    },
);

test('a NOTICE file does not count as a LICENSE', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['docs'], { level: 'all' }),
        'README.md': README,
        NOTICE: 'Copyright Example',
    });
    expect(await checkFindings(sandbox.path, 'docs/required-files')).toMatchObject([
        { file: 'LICENSE', rule: 'missing-license' },
    ]);
});
