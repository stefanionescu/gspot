import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { ACTIVE_URLS, INERT_MARKUP } from '#tests/data/checks/html.ts';

test.each([...ACTIVE_URLS])(
    'html/scripts reports the executable URL in $markup at its attribute column',
    async ({ markup, column }) => {
        await using folder = await testdir();
        await createFileTree(folder.path, {
            'gspot.toml': buildSettingsText(['html'], { level: 'all' }),
            'page.html': markup,
        });
        const session = await openSession(folder.path);
        const findings = await checkFindings(session.root, 'html/scripts', { paths: ['page.html'] });
        expect(
            findings.map(({ file, line, rule, column: foundColumn }) => ({
                file,
                line,
                rule,
                column: foundColumn,
            })),
        ).toStrictEqual([{ file: 'page.html', line: 1, rule: 'script-link', column }]);
    },
);

test.each([...INERT_MARKUP])('html/scripts accepts the inert markup %s', async (markup) => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['html'], { level: 'all' }),
        'page.html': markup,
    });
    const session = await openSession(folder.path);
    expect(await checkFindings(session.root, 'html/scripts', { paths: ['page.html'] })).toStrictEqual([]);
});
