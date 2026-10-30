import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { TYPO } from '#tests/config/spelling.ts';
import { planChecks } from '#cli/planning/checks.ts';
import { openSession } from '#cli/planning/session.ts';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { parseCommandFindings } from '#cli/runs/command/output.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { TYPO_REPORT, TYPOS_REPORT_ERRORS, TYPOS_FINDING_CASES } from '#tests/config/runs/output/output.ts';

test('the typos format tells findings from fatal exits', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['spelling']),
        'sample.txt': `${TYPO.the}\n`,
    });

    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'all', only: ['spelling/typos'] })[0]!;
    const stdout = JSON.stringify(TYPO_REPORT);
    const result = buildProcessResult({ stdout, code: 2 });
    expect(parseCommandFindings(planned, result, { cwd: sandbox.path, root: sandbox.path }).findings).toStrictEqual([
        {
            check: planned.check.id,
            file: 'sample.txt',
            line: 1,
            column: 1,
            message: `\`${TYPO.the}\` should be \`the\``,
            help: planned.check.help,
            fixable: true,
        },
    ]);
    expect(
        parseCommandFindings(
            planned,
            { ...result, code: 78, stderr: 'Invalid native configuration.' },
            { cwd: sandbox.path, root: sandbox.path },
        ).note,
    ).toBe(`typos failed with exit 78:\nInvalid native configuration.\n${stdout}`);
    expect(
        parseCommandFindings(planned, { ...result, stdout: '' }, { cwd: sandbox.path, root: sandbox.path }).note,
    ).toBe('typos failed with exit 2 and printed nothing.');
    expect(
        parseCommandFindings(planned, { ...result, stdout: '', code: 0 }, { cwd: sandbox.path, root: sandbox.path })
            .findings,
    ).toStrictEqual([]);
});

test.each([...TYPOS_REPORT_ERRORS])('typos refuses $name: $message', async ({ output, message }) => {
    const stdout = JSON.stringify(output);
    await using sandbox = await testdir({ 'sample.txt': `${TYPO.the}\n` });
    const check = getShippedCheck('spelling/typos');
    expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(message);
});

test.each(TYPOS_FINDING_CASES)('typos reads $name', async ({ report, source, expected }) => {
    await using sandbox = await testdir({ [report.path]: source });
    const check = getShippedCheck('spelling/typos');
    expect(parseOutput(check, JSON.stringify(report), '', { root: sandbox.path, cwd: sandbox.path })).toStrictEqual([
        { check: check.id, help: check.help, ...expected },
    ]);
});
