// Public HTML script findings retain decoded URL semantics and their source locations.
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { scripts } from '#cli/checks/language/html.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { ACTIVE_URLS, INERT_MARKUP } from '#tests/config/cli/checks/language/html.ts';

describe('HTML script findings', () => {
    test.each(ACTIVE_URLS)(
        'reports the executable URL in $markup at its attribute column',
        async ({ markup, column }) => {
            await using directory = await testdir();
            await createFileTree(directory.path, { 'gspot.toml': buildPolicy(['html']), 'page.html': markup });
            const session = await openSession(directory.path);
            const findings = await scripts(buildEngineInput(session, 'html/scripts', { paths: ['page.html'] }));
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
    test.each(INERT_MARKUP)('accepts the inert markup %s', async (markup) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'gspot.toml': buildPolicy(['html']), 'page.html': markup });
        const session = await openSession(directory.path);
        expect(await scripts(buildEngineInput(session, 'html/scripts', { paths: ['page.html'] }))).toStrictEqual([]);
    });
});
