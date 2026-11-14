import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import type { CheckStop } from '#cli/system/errors.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { TYPO } from '#tests/config/setup/configurations.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { TYPO_REPORT, TYPOS_FINDING_CASES } from '#tests/config/engine/outputs.ts';

test('typos refuses a report of a missing source', async () => {
    const output = { ...TYPO_REPORT, path: 'missing.txt' };
    const stdout = JSON.stringify(output);
    await using sandbox = await testdir({ 'sample.txt': `${TYPO.the}\n` });
    const check = getShippedCheck('spelling/typos');
    expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(
        matchFields<CheckStop>({
            name: 'CheckStop',
            status: 'error',
            message: expect.stringContaining(output.path) as string,
        }),
    );
});

test('a typos position past the end of its line stops the check with an error', async () => {
    const output = { ...TYPO_REPORT, byte_offset: TYPO.the.length + 1 };
    await using sandbox = await testdir({ 'sample.txt': `${TYPO.the}\n` });
    const check = getShippedCheck('spelling/typos');
    expect(() => parseOutput(check, JSON.stringify(output), '', { root: sandbox.path, cwd: sandbox.path })).toThrow(
        matchFields<CheckStop>({ name: 'CheckStop', status: 'error' }),
    );
});

test.each(TYPOS_FINDING_CASES)('typos reads $name', async ({ report, source, expected }) => {
    await using sandbox = await testdir({ [report.path]: source });
    const check = getShippedCheck('spelling/typos');
    expect(parseOutput(check, JSON.stringify(report), '', { root: sandbox.path, cwd: sandbox.path })).toStrictEqual([
        { check: check.id, ...expected },
    ]);
});
