import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { URL_MARKUP_CASES } from '#tests/data/checks/html.ts';

test.each([...URL_MARKUP_CASES])(
    'html/scripts reports each URL in $markup that runs code, at its attribute column',
    async ({ markup, columns }) => {
        await using folder = await testdir();
        await createFileTree(folder.path, {
            'gspot.toml': buildSettingsText(['html'], { level: 'all' }),
            'page.html': markup,
        });
        const session = await openSession(folder.path);
        const findings = await checkFindings(session.root, 'html/scripts', { paths: ['page.html'] });
        expect(findings.map(({ file, line, rule, column }) => ({ file, line, rule, column }))).toStrictEqual(
            columns.map((column) => ({ file: 'page.html', line: 1, rule: 'script-link', column })),
        );
    },
);
