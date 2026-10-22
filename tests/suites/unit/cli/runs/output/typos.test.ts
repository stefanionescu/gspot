import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { planChecks } from '#cli/planning/checks.ts';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { TYPO } from '#tests/config/checks/general/spelling.ts';
import { parseCommandFindings } from '#cli/runs/command/output.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getShippedCheck } from '#tests/setup/cli/configurations.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { TYPO_REPORT, TYPOS_REPORT_ERRORS } from '#tests/config/runs/output/typos.ts';

test('the typos format tells findings from fatal exits', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['spelling']),
        'sample.txt': `${TYPO.the}\n`,
    });

    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'all', only: ['spelling/typos'] });
    const planned = plans[0]!;
    const stdout = JSON.stringify(TYPO_REPORT);
    const result = buildProcessResult({ stdout, stderr: '', code: 2, missing: false, duration: 1 });
    expect(parseCommandFindings(planned, result, { cwd: sandbox.path, root: sandbox.path }).findings).toMatchObject([
        { file: 'sample.txt' },
    ]);
    expect(
        parseCommandFindings(
            planned,
            { ...result, code: 78, stderr: 'Invalid native configuration.' },
            { cwd: sandbox.path, root: sandbox.path },
        ).note,
    ).toBeDefined();
    expect(
        parseCommandFindings(planned, { ...result, stdout: '' }, { cwd: sandbox.path, root: sandbox.path }).note,
    ).toBeDefined();
    expect(
        parseCommandFindings(planned, { ...result, stdout: '', code: 0 }, { cwd: sandbox.path, root: sandbox.path })
            .findings,
    ).toStrictEqual([]);
});

test.each([...TYPOS_REPORT_ERRORS])('typos refuses $name: $message', async ({ output, message }) => {
    const stdout = typeof output === 'string' ? output : JSON.stringify(output);
    await using sandbox = await testdir({ 'sample.txt': `${TYPO.the}\n` });
    const check = getShippedCheck('spelling/typos');
    expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(message);
});
