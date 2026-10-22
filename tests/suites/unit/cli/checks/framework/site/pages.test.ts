import { test, expect } from 'bun:test';
import { runCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { SITE_SANDBOX, BUILT_PAGE_CASES } from '#tests/config/checks/framework/site/pages.ts';

test.each([...BUILT_PAGE_CASES])(
    'site/pages: $check reports its finding in the built site and passes after the fix',
    async (entry) => {
        await using repository = await createSandbox(SITE_SANDBOX);
        const { failed, passed } = await runCheckSample(repository, entry, SITE_SANDBOX);
        expect(passed.report.failed).toStrictEqual([]);

        expect(failed.report.checks).toMatchObject([
            { check: entry.check, status: 'failed', findings: [entry.expected] },
        ]);
    },
);
