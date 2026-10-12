import { test, expect } from 'bun:test';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { SITE_REPOSITORY } from '#tests/config/site/project.ts';
import { BUILT_PAGE_CASES } from '#tests/config/site/built-pages.ts';

test.each([...BUILT_PAGE_CASES])('$check reports its source and accepts the corrected output', async (entry) => {
    await using repository = await createSandbox(SITE_REPOSITORY);
    const { failed, passed } = await runCheckSample(repository, entry, SITE_REPOSITORY);
    expect(failed.code, failed.stderr).toBe(1);
    expect(failed.report.checks).toMatchObject([{ check: entry.check, status: 'failed', findings: [entry.expected] }]);
    expect(passed.code, passed.stderr).toBe(0);
});
