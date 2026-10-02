import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { existsSync, writeFileSync } from 'node:fs';
import * as inspections from '#cli/tools/inspect.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { runEngineCheck } from '#cli/execution/engines.ts';
import { copiedBlocks } from '#cli/checks/general/duplication.ts';

const VALID = {
    report: { statistics: { total: { percentage: 0 } }, duplicates: [] },
    code: 0,
    isTimedOut: false,
    isCanceled: false,
};

test.each([
    { failure: 'missing statistics', changes: { report: { duplicates: [] } } },
    { failure: 'fatal exit', changes: { code: 1 } },
    { failure: 'deadline', changes: { isTimedOut: true } },
    { failure: 'cancellation', changes: { isCanceled: true } },
])('duplication rejects $failure, removes temporary reports, and accepts a corrected report', async ({ changes }) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['bash', 'duplication'], '', 'all'),
        'sample.sh': 'echo example\n',
        '.gspot/config/jscpd.json': '{}\n',
    });
    const session = await openSession(directory.path);
    const [planned] = planRun(session, { stage: 'push', skips: [], only: ['duplication/jscpd'] });
    const directories: string[] = [];
    let isCorrected = false;
    const inspection = spyOn(inspections, 'inspectTool').mockReturnValue({
        name: 'jscpd',
        state: 'ok',
        path: process.execPath,
    });
    const spawn = spyOn(processes, 'run').mockImplementation((command) => {
        const output = command[command.indexOf('--output') + 1]!;
        directories.push(output);
        const { report, ...status } = { ...VALID, ...(isCorrected ? {} : changes) };
        writeFileSync(join(output, 'jscpd-report.json'), JSON.stringify(report));
        return Promise.resolve({
            ...status,
            stdout: '',
            stderr: 'Native scan failed.',
            missing: false,
            duration: 1,
        });
    });
    try {
        const failed = await runEngineCheck(session, copiedBlocks, planned!);
        expect(failed.status).toBe('error');
        expect(failed.findings).toStrictEqual([]);
        expect(directories).toHaveLength(1);
        expect(directories.every((path) => !existsSync(path))).toBe(true);
        isCorrected = true;
        const result = await runEngineCheck(session, copiedBlocks, planned!);
        expect(result.status).toBe('passed');
        expect(directories.every((path) => !existsSync(path))).toBe(true);
    } finally {
        spawn.mockRestore();
        inspection.mockRestore();
    }
});
