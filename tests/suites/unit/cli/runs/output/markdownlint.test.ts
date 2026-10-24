import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { getShippedCheck } from '#tests/setup/cli/configurations.ts';
import { MARKDOWN_REPORT, MARKDOWNLINT_REPORT_ERRORS } from '#tests/config/runs/output/markdownlint.ts';

test('a markdownlint JSON item becomes a finding', async () => {
    await using sandbox = await testdir({ 'sample.md': '<span>Content</span>\n' });

    const check = getShippedCheck('markdown/markdownlint');
    expect(
        parseOutput(check, JSON.stringify([MARKDOWN_REPORT]), '', { root: sandbox.path, cwd: sandbox.path }),
    ).toMatchObject([{ file: 'sample.md', rule: 'MD033', fixable: false }]);
});
test.each([...MARKDOWNLINT_REPORT_ERRORS])('markdownlint refuses $name', async ({ output }) => {
    const stdout = typeof output === 'string' ? output : JSON.stringify(output);
    await using sandbox = await testdir({ 'sample.md': '<span>Content</span>\n' });
    const check = getShippedCheck('markdown/markdownlint');
    expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(
        new Error('Markdownlint printed output that gspot cannot read.'),
    );
});
