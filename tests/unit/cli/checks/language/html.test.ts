import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { ACTIVE_URLS, INERT_MARKUP } from '#tests/config/html.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';

test.each([...ACTIVE_URLS])(
    'html/scripts reports the executable URL in $markup at its attribute column',
    async ({ markup, column }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': settingsText(['html'], { level: 'all' }),
            'page.html': markup,
        });
        const session = await openSession(directory.path);
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
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['html'], { level: 'all' }),
        'page.html': markup,
    });
    const session = await openSession(directory.path);
    expect(await checkFindings(session.root, 'html/scripts', { paths: ['page.html'] })).toStrictEqual([]);
});

test('html/template-text skips the paths of its templates setting and still checks other files', async () => {
    const configuration = 'html';
    const check = 'html/template-text';
    const setting = '[html]\ntemplates = ["public/**/*.html"]\n';
    const path = 'trusted/page.html';
    const source = '<p>Private template copy</p>\n';
    const correction = '<p>{{ title }}</p>\n';
    const rule = 'literal-text';
    await using sandbox = await testdir();
    const settings = settingsText([configuration], { tables: setting, level: 'all' });
    const untrusted = path.replace('trusted/', 'public/');
    await createFileTree(sandbox.path, { 'gspot.toml': settings, [path]: source, [untrusted]: source });
    const command = ['check', '--only', check, '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap((entry) => entry.findings)).toMatchObject([{ file: untrusted, line: 1, rule }]);
    await Bun.write(`${sandbox.path}/${untrusted}`, correction);
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
