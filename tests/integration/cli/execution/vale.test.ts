import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import * as inspections from '#cli/tools/inspect.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { runEngineCheck } from '#cli/execution/engines.ts';
import { containing } from '#tests/harness/expectations.ts';
import { valeFindings } from '#cli/checks/general/prose/vale.ts';

const DIAGNOSTIC = { Line: 1, Span: [3, 5], Check: 'gspot.Example', Message: 'Use a concrete example.' };

test.each(['outdated', 'deadline', 'cancellation'])(
    'Vale rejects %s and accepts corrected execution',
    async (failure) => {
        await using directory = await testdir();
        const path = 'sample.md';
        const source = '# Example text\n';
        await createFileTree(directory.path, {
            'gspot.toml': policyOf(['prose', 'bash', 'markdown'], 'timeout = 1\n'),
            '.gspot/config/vale.ini': 'Packages =\n',
            [path]: source,
        });
        const session = await openSession(directory.path);
        const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
        const inspection = spyOn(inspections, 'inspectTool').mockReturnValue({
            name: 'vale',
            state: failure === 'outdated' ? 'outdated' : 'ok',
            path: process.execPath,
            found: '0.0.1',
        });
        const spawn = spyOn(processes, 'run').mockResolvedValue({
            code: 1,
            stdout: '',
            stderr: '',
            missing: false,
            duration: 1,
            isTimedOut: failure === 'deadline',
            isCanceled: failure === 'cancellation',
        });
        try {
            const failed = await runEngineCheck(session, valeFindings, planned!);
            expect(failed.status).toBe(failure === 'outdated' ? 'missing' : 'error');
            expect(failed.findings).toStrictEqual([]);
            inspection.mockReturnValue({ name: 'vale', state: 'ok', path: process.execPath });
            spawn.mockImplementation((command, options) => {
                expect(options.timeoutMs).toBe(1000);
                expect(command).toContain(path);
                expect(options.stdin).toBeUndefined();
                return Promise.resolve({
                    code: 0,
                    stdout: JSON.stringify({ [join(directory.path, path)]: [DIAGNOSTIC] }),
                    stderr: '',
                    missing: false,
                    duration: 1,
                });
            });
            const corrected = await runEngineCheck(session, valeFindings, planned!);
            expect(corrected.status).toBe('failed');
            expect(corrected.findings).toStrictEqual([
                containing({ file: path, line: 1, column: 3, rule: 'gspot.Example' }),
            ]);
            spawn.mockResolvedValue({ code: 0, stdout: '{}', stderr: '', missing: false, duration: 1 });
            const result = await runEngineCheck(session, valeFindings, planned!);
            expect(result.status).toBe('passed');
        } finally {
            spawn.mockRestore();
            inspection.mockRestore();
        }
    },
);
