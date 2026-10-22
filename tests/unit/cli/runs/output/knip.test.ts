import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { getShippedCheck } from '#tests/setup/cli/configurations.ts';
import { INVALID_KNIP_REPORTS } from '#tests/data/runs/output/knip.ts';

test.each([...INVALID_KNIP_REPORTS])('an invalid Knip report is refused: %s', async (stdout) => {
    const check = getShippedCheck('javascript/knip');

    await using sandbox = await testdir();
    expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(GspotError);
});
