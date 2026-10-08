import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import * as toolRunner from '#cli/execution/command/public.ts';
import { linkinator } from '#cli/checks/general/site/public.ts';
import { cachedBuild } from '#cli/checks/general/site/contracts.ts';
import type { SiteReportCase } from '#tests/types/cli/checks/general/site.ts';
import { SITE_POLICY, SITE_BUILD_SCRIPT } from '#tests/config/samples/site.ts';

const SITE_REPORTS: SiteReportCase[] = [
    {
        name: 'links',
        check: 'site/linkinator',
        analyze: (input) => linkinator(input, false),
        report: () => ({
            links: [{ url: 'https://example.com/missing', parent: 'index.html', state: 'BROKEN', status: 404 }],
        }),
        corrected: { links: [] },
        status: 1,
        file: 'dist/index.html',
        rule: 'broken-link',
    },
    {
        name: 'markup',
        check: 'site/html-validate',
        analyze: BUILT_IN_CHECKS['site/html-validate'].input,
        report: (output: string) => [
            {
                filePath: join(output, 'index.html'),
                messages: [{ ruleId: 'doctype', line: 1, message: 'Missing doctype.' }],
            },
        ],
        corrected: [],
        status: 1,
        file: 'dist/index.html',
        rule: 'doctype',
    },
    {
        name: 'selectors',
        check: 'site/purgecss',
        analyze: BUILT_IN_CHECKS['site/purgecss'].input,
        report: () => [{ file: 'style.css', rejected: ['.unused'] }],
        corrected: [{ file: 'style.css', rejected: [] }],
        status: 0,
        file: 'dist/style.css',
        rule: 'dead-selector',
    },
];

test.each(SITE_REPORTS)(
    '$name rejects fatal, absent, and malformed reports and handles findings before and after fixes',
    async ({ analyze, check, report, status, file, rule, corrected }) => {
        await using sandbox = await testdir();
        using resources = new DisposableStack();
        await createFileTree(sandbox.path, { 'gspot.toml': SITE_POLICY, 'build.js': SITE_BUILD_SCRIPT });
        const request = buildCheckInput(await openSession(sandbox.path), check, {
            paths: ['build.js'],
            resources: resources,
        });
        const build = await cachedBuild(request);
        await writeFile(join(build.output, 'style.css'), 'body { color: red; }');
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
            stdout = JSON.stringify(report(build.output));
            code = status;
            expect(await analyze(request)).toMatchObject([{ check: request.check.name, file, line: 1, rule }]);
            code = 0;
            stdout = JSON.stringify(corrected);
            expect(await analyze(request)).toStrictEqual([]);
        } finally {
            command.mockRestore();
        }
    },
);
