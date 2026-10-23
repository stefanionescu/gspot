import { test, expect } from 'bun:test';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { SITE_SANDBOX, BUILT_PAGE_CASES } from '#tests/config/checks/framework/site/pages.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

test.each([...BUILT_PAGE_CASES])(
    '$check reports its finding in the built site and passes after the fix',
    async (entry) => {
        await using repository = await createSandbox(SITE_SANDBOX);
        const result = await runCheckSample(repository, entry, SITE_SANDBOX);
        expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
    },
);
