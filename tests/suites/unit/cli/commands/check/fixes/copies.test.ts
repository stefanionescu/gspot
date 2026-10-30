import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runFixers } from '#cli/commands/check/fixes.ts';
import { buildCheckSession } from '#cli/commands/check/run.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { planFixer, buildFixerSettings } from '#tests/setup/cli/runs.ts';
import { waitForExit, waitForFile } from '#tests/setup/system/processes.ts';

test('a fix in a copy writes only the selected file back and removes the copy', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildFixerSettings(),
        'source.txt': 'original',
        'unowned.json': '{}',
    });

    const session = await openSession(sandbox.path);
    const trace = join(sandbox.path, 'workspace-path');
    const planned = planFixer(
        session,
        buildProgramCommand(
            'fakes/tool',
            '--refuse-file',
            'unowned.json',
            '--record-cwd',
            trace,
            '--write',
            'source.txt=corrected',
            '--exit',
            '3',
        ),
    );
    planned.check.run_in_copy = true;
    planned.check.exit_codes = [3];
    const result = await runFixers(buildCheckSession(session), [planned]);
    expect(result.results).toMatchObject([{ status: 'changed', changed: ['source.txt'] }]);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
    expect(await readFile(join(sandbox.path, 'unowned.json'), 'utf8')).toBe('{}');
    expect(await isOnDisk(await readFile(trace, 'utf8'))).toBe(false);
});

test.each([false, true])(
    'a canceled fix keeps its partial changes and reports the process failure (in a copy: %p)',
    async (isolated) => {
        await using sandbox = await testdir({
            'gspot.toml': buildFixerSettings(),
            'source.txt': 'original',
        });

        const session = await openSession(sandbox.path);
        const controller = new AbortController();
        const ready = join(sandbox.path, 'ready.pid');
        const planned = planFixer(
            session,
            buildProgramCommand('fakes/tool', '--write', 'source.txt=partial', '--mark', ready, '--wait'),
        );
        planned.check.run_in_copy = isolated;
        session.cancelSignal = controller.signal;
        const execution = runFixers(buildCheckSession(session), [planned]);
        try {
            expect(await waitForFile(ready)).toBe(true);
            const pid = Number(await readFile(ready, 'utf8'));
            controller.abort();
            const report = await execution;
            const result = report.results[0]!;
            await waitForExit(pid);
            expect(result).toMatchObject({
                status: 'canceled',
                note: 'sandbox/fixer was canceled.',
                changed: ['source.txt'],
            });
            expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('partial');
        } finally {
            controller.abort();
            await execution;
        }
        delete session.cancelSignal;
        const correctedRun = await runFixers(buildCheckSession(session), [
            planFixer(session, buildProgramCommand('fakes/tool', '--write', 'source.txt=corrected')),
        ]);
        const corrected = correctedRun.results[0]!;
        expect(corrected.status).toBe('changed');
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
    },
);
