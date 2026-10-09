import { test, spyOn } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import * as toolRunner from '#cli/execution/command/public.ts';
import { linkinator } from '#cli/checks/general/site/public.ts';
import type { SiteReportCase } from '#tests/types/cli/checks/site.ts';
import { SITE_POLICY, SITE_BUILD_SCRIPT } from '#tests/config/samples/site.ts';

const SITE_REPORTS: SiteReportCase[] = [
    { name: 'links', check: 'site/linkinator', analyze: (input) => linkinator(input, false) },
    { name: 'markup', check: 'site/html-validate', analyze: BUILT_IN_CHECKS['site/html-validate'].input },
    { name: 'selectors', check: 'site/purgecss', analyze: BUILT_IN_CHECKS['site/purgecss'].input },
];

test.each(SITE_REPORTS)('$name rejects fatal, absent, and malformed reports', async ({ analyze, check }) => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, { 'gspot.toml': SITE_POLICY, 'build.js': SITE_BUILD_SCRIPT });
    const request = buildCheckInput(await openSession(sandbox.path), check, {
        paths: ['build.js'],
        resources: resources,
    });
    let code = 2;
    let stdout = '';
    const command = spyOn(toolRunner, 'runCheckTool').mockImplementation(async (_input, argv) => {
        if (Array.isArray(argv)) {
            const formatter = argv.find((argument) => argument.startsWith('json='));
            if (formatter !== undefined) await writeFile(formatter.slice('json='.length), stdout);
        }
        return { code, stdout, stderr: 'Test tool diagnostic', missing: false, duration: 1 };
    });
    try {
        await rejection(analyze(request));
        code = 0;
        for (const invalid of ['', '{ broken', '{}']) {
            stdout = invalid;
            await rejection(analyze(request));
        }
    } finally {
        command.mockRestore();
    }
});
