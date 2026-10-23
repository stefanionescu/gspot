import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { URL_MARKUP_CASES, INLINE_SCRIPT_PAGE } from '#tests/config/checks/language/html.ts';

test.each([...URL_MARKUP_CASES])(
    'html/inline-scripts reports each URL in $markup that runs code, at its attribute column',
    async ({ markup, columns }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['html'], { level: 'all' }),
            'page.html': markup,
        });

        const findings = await runSandboxCheck(sandbox.path, 'html/inline-scripts', { paths: ['page.html'] });
        expect(findings.map(({ file, line, rule, column }) => ({ file, line, rule, column }))).toStrictEqual(
            columns.map((column) => ({ file: 'page.html', line: 1, rule: 'script-link', column })),
        );
    },
);

test('html/inline-scripts reports an executable inline script and an event handler attribute, and skips an inert or linked script', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['html'], { level: 'all' }),
        'index.html': INLINE_SCRIPT_PAGE,
    });
    const found = await runSandboxCheck(sandbox.path, 'html/inline-scripts');
    expect(found.map(({ file, line, column, rule, message }) => ({ file, line, column, rule, message }))).toStrictEqual(
        [
            {
                file: 'index.html',
                line: 5,
                column: 1,
                rule: 'inline-script',
                message: 'Move executable inline script to a script file.',
            },
            {
                file: 'index.html',
                line: 6,
                column: 9,
                rule: 'handler-attribute',
                message: 'The onclick attribute is inline script. Attach the handler from a script file.',
            },
        ],
    );
});
