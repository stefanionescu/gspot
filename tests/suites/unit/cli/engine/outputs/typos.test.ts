import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
import { parseCommandFindings } from '#cli/engine/tool-runs/output.ts';
import type { CheckStop } from '#cli/system/errors.ts';
import { TYPO_REPORT, TYPOS_FINDING_CASES } from '#tests/config/engine/outputs.ts';
import { TYPO } from '#tests/config/setup/configurations.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('the typos format reads the report of an exit 2 into findings', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['spelling']),
        'sample.txt': `${TYPO.the}\n`,
    });

    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'all', only: ['spelling/typos'] })[0]!;
    const stdout = JSON.stringify(TYPO_REPORT);
    const result = buildProcessResult({ stdout, code: 2 });
    expect(parseCommandFindings(planned, result, { cwd: sandbox.path, root: sandbox.path }, {}).findings).toStrictEqual(
        [
            {
                check: planned.check.id,
                file: 'sample.txt',
                line: 1,
                column: 1,
                message: `\`${TYPO.the}\` should be \`the\``,
                fixable: false,
            },
        ],
    );
});

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

test.each(TYPOS_FINDING_CASES)('typos reads $name', async ({ report, source, expected }) => {
    await using sandbox = await testdir({ [report.path]: source });
    const check = getShippedCheck('spelling/typos');
    expect(parseOutput(check, JSON.stringify(report), '', { root: sandbox.path, cwd: sandbox.path })).toStrictEqual([
        { check: check.id, ...expected },
    ]);
});
