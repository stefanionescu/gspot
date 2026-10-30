import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { MARKDOWN_REPORT } from '#tests/config/runs/output/output.ts';

test('a markdownlint JSON result becomes a finding', async () => {
    await using sandbox = await testdir({ 'sample.md': '<span>Content</span>\n' });

    const check = getShippedCheck('markdown/markdownlint');
    expect(
        parseOutput(check, JSON.stringify([MARKDOWN_REPORT]), '', { root: sandbox.path, cwd: sandbox.path }),
    ).toStrictEqual([
        {
            check: check.id,
            file: 'sample.md',
            line: 1,
            column: 1,
            rule: 'MD033',
            message: 'Inline HTML: Element: span',
            help: check.help,
            fixable: false,
        },
    ]);
});
test('markdownlint refuses a report with an invalid fix', async () => {
    const stdout = JSON.stringify([{ ...MARKDOWN_REPORT, fixInfo: [] }]);
    await using sandbox = await testdir({ 'sample.md': '<span>Content</span>\n' });
    const check = getShippedCheck('markdown/markdownlint');
    expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(
        new Error('Markdownlint printed output that gspot cannot read.'),
    );
});
