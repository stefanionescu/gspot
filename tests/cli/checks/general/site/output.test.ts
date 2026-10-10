import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';
import * as toolRunner from '#cli/execution/command/public.ts';
import { linkinator } from '#cli/checks/general/site/public.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { SITE_REPORTS } from '#tests/config/cli/checks/general/site/output.ts';
import { SITE_POLICY, STATIC_SITE_FILES } from '#tests/config/samples/site.ts';

const analyzers = {
    links: (input: CheckInput) => linkinator(input, false),
    markup: BUILT_IN_CALCULATIONS['site/html-validate'],
    selectors: BUILT_IN_CALCULATIONS['site/purgecss'],
};

test.each([...SITE_REPORTS])(
    '$name rejects fatal, absent, and malformed reports',
    async ({ name, check, fatal, reports }) => {
        const analyze = analyzers[name];
        await using sandbox = await testdir();
        using resources = new DisposableStack();
        await createFileTree(sandbox.path, { ...STATIC_SITE_FILES, 'gspot.toml': SITE_POLICY });
        const request = buildCheckInput(await openSession(sandbox.path), check, {
            resources: resources,
        });
        await BUILT_IN_CALCULATIONS['site/build'](request);
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
            expect(await rejection(analyze(request))).toContain(fatal);
            code = 0;
            for (const { output, reason } of reports) {
                stdout = output;
                expect(await rejection(analyze(request))).toContain(reason);
            }
        } finally {
            command.mockRestore();
        }
    },
);
