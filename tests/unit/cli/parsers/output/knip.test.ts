import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { parseOutput } from '#cli/parsers/output/formats.ts';
import { INVALID_KNIP_REPORTS } from '#tests/config/knip.ts';
import { readManifests } from '#cli/configurations/manifests.ts';

const check = readManifests()
    .get('javascript')!
    .checks.find(({ name }) => name === 'javascript/knip')!;

test.each([...INVALID_KNIP_REPORTS])('an invalid Knip report is refused: %s', async (stdout) => {
    await using sandbox = await testdir();
    expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(GspotError);
});
