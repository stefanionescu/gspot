import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { checkFindings } from '#tests/setup/check-input.ts';
import { URL_MARKUP_CASES } from '#tests/data/checks/html.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';

test.each([...URL_MARKUP_CASES])(
    'html/scripts reports each URL in $markup that runs code, at its attribute column',
    async ({ markup, columns }) => {
        await using folder = await testdir({
            'gspot.toml': buildSandboxSettings(['html'], { level: 'all' }),
            'page.html': markup,
        });

        const findings = await checkFindings(folder.path, 'html/scripts', { paths: ['page.html'] });
        expect(findings.map(({ file, line, rule, column }) => ({ file, line, rule, column }))).toStrictEqual(
            columns.map((column) => ({ file: 'page.html', line: 1, rule: 'script-link', column })),
        );
    },
);
