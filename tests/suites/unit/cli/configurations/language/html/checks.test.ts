import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { URL_MARKUP_CASES, SCRIPT_TYPE_CASES, INLINE_SCRIPT_PAGE } from '#tests/config/configurations/language.ts';

test.each([...SCRIPT_TYPE_CASES])(
    'html/inline-scripts treats type "$type" like the browser',
    async ({ type, rules }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['html'], { level: 'all' }),
            'index.html': `<script type="${type}">window.start();</script><script type="${type}" src="data:text/javascript,window.start()"></script>`,
        });
        const findings = await runSandboxCheck(sandbox.path, 'html/inline-scripts');
        expect(findings.map(({ rule }) => rule)).toStrictEqual([...rules]);
    },
);

test.each([...URL_MARKUP_CASES])(
    'html/inline-scripts reports each URL in $markup that runs code, at its attribute column',
    async ({ markup, columns, scheme }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['html'], { level: 'all' }),
            'page.html': markup,
        });

        const findings = await runSandboxCheck(sandbox.path, 'html/inline-scripts', { paths: ['page.html'] });
        expect(findings).toStrictEqual(
            columns.map((column) =>
                matchFields({
                    file: 'page.html',
                    line: 1,
                    rule: 'script-link',
                    column,
                    message: expect.stringContaining(scheme) as string,
                }),
            ),
        );
    },
);

test('html/inline-scripts reports an executable inline script and an event handler attribute, and skips an inert or linked script', async () => {
    await using sandbox = await createGitSandbox({
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
                message: expect.any(String) as string,
            },
            {
                file: 'index.html',
                line: 6,
                column: 9,
                rule: 'handler-attribute',
                message: expect.stringContaining('onclick') as string,
            },
        ],
    );
});

test('prototype property tag names with data URLs do not crash the check', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['html'], { level: 'all' }),
        'index.html': '<constructor src="data:text/javascript,run()"></constructor>',
    });
    expect(await runSandboxCheck(sandbox.path, 'html/inline-scripts')).toStrictEqual([]);
});
