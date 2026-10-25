import * as os from 'node:os';
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runFixers } from '#cli/commands/check/fixes.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { rm, stat, mkdir, readdir, readFile } from 'node:fs/promises';
import { planFixer, buildFixerSettings } from '#tests/setup/cli/runs.ts';
import { waitForExit, waitForFile } from '#tests/setup/system/processes.ts';
import { COPY_FAILURES } from '#tests/config/commands/check/fixes/copies.ts';

test("a fixer's {root} environment paths point into the copy during a dry run", async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildFixerSettings(),
        'source.txt': 'original',
        'café settings.txt': 'corrected',
    });

    const trace = join(sandbox.path, 'execution-root');
    const session = await openSession(sandbox.path);
    const planned = planFixer(
        session,
        buildProgramCommand(
            'fakes/tool',
            '--write',
            'café settings.txt=scratch corrected',
            '--copy-environment-file',
            'source.txt=SANDBOX_SETTINGS',
            '--record-cwd',
            trace,
        ),
    );
    planned.check.env = { SANDBOX_SETTINGS: '{root}/café settings.txt' };
    const result = await runFixers(session, [planned], { isDryRun: true });
    expect(result.results).toMatchObject([{ status: 'changed', changed: ['source.txt'] }]);
    expect(result.diffs).toStrictEqual([buildSourceDiff('scratch corrected')]);
    const executionRoot = await readFile(trace, 'utf8');
    expect(executionRoot).not.toBe(sandbox.path);
    expect(await isOnDisk(executionRoot)).toBe(false);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    expect(await readFile(join(sandbox.path, 'café settings.txt'), 'utf8')).toBe('corrected');
});

test.each([false, true])(
    'a fix in a copy writes only the selected file back and removes the copy (dry run %p)',
    async (preview) => {
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
        const result = await runFixers(session, [planned], { isDryRun: preview });
        expect(result.results).toMatchObject([{ status: 'changed', changed: ['source.txt'] }]);
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe(preview ? 'original' : 'corrected');
        expect(await readFile(join(sandbox.path, 'unowned.json'), 'utf8')).toBe('{}');
        expect(await isOnDisk(await readFile(trace, 'utf8'))).toBe(false);
        expect(result.diffs).toStrictEqual(preview ? [buildSourceDiff('corrected')] : []);
    },
);

test('a fix in a copy refuses to overwrite a file changed while it ran, and removes the copy', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildFixerSettings(['*.txt']),
        'source.txt': 'original',
        'z-last.txt': 'last original',
    });

    const session = await openSession(sandbox.path);
    const trace = join(sandbox.path, 'workspace-path');
    const planned = planFixer(
        session,
        buildProgramCommand(
            'fakes/tool',
            '--record-cwd',
            trace,
            '--write',
            `${join(sandbox.path, 'z-last.txt')}=new working content`,
            '--write',
            'source.txt=isolated correction',
            '--write',
            'z-last.txt=last correction',
        ),
    );
    planned.check.run_in_copy = true;
    const rejection = await captureRejection(runFixers(session, [planned], { isDryRun: false }));
    expect(rejection.message).toBe('z-last.txt changed while gspot wrote it. Run the command again.');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('isolated correction');
    expect(await readFile(join(sandbox.path, 'z-last.txt'), 'utf8')).toBe('new working content');
    expect(await isOnDisk(await readFile(trace, 'utf8'))).toBe(false);
    const corrected = planFixer(session, buildProgramCommand('fakes/tool', '--write', 'source.txt=corrected'));
    corrected.check.run_in_copy = true;
    const correctedRun = await runFixers(session, [corrected], { isDryRun: false });
    expect(correctedRun.results[0]).toMatchObject({
        status: 'changed',
        changed: ['source.txt'],
    });
});

test('a failed dry-run fix removes its copy and keeps the source bytes', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(
        session,
        buildProgramCommand('fakes/tool', '--write', 'source.txt=partial', '--print-cwd', '--exit', '3'),
    );
    const temporary = join(sandbox.path, 'scratch');
    await mkdir(temporary);
    using _temporaryFolder = spyOn(os, 'tmpdir').mockReturnValue(temporary);
    const report = await runFixers(session, [planned], { isDryRun: true });
    expect(report.results).toMatchObject([{ status: 'failed' }]);
    expect(await readdir(temporary)).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    expect(report.changed).toStrictEqual(['source.txt']);
    expect(report.diffs).toStrictEqual([buildSourceDiff('partial')]);
});

test.each([...COPY_FAILURES])('a failed $operation removes the copy', async ({ operation, message }) => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--replace-with-folder', 'source.txt'));
    if (operation === 'copy') {
        await rm(join(sandbox.path, 'source.txt'));
        await mkdir(join(sandbox.path, 'source.txt'));
    }
    const temporary = join(sandbox.path, 'scratch');
    await mkdir(temporary);
    using _temporaryFolder = spyOn(os, 'tmpdir').mockReturnValue(temporary);
    const runFixersError = await captureRejection(runFixers(session, [planned], { isDryRun: true }));
    expect(runFixersError.message).toContain(message);
    expect(await readdir(temporary)).toStrictEqual([]);
    if (operation === 'copy') {
        const attributes = await stat(join(sandbox.path, 'source.txt'));
        expect(attributes.isDirectory()).toBe(true);
    } else expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
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
        const execution = runFixers(session, [planned], { isDryRun: false });
        try {
            expect(await waitForFile(ready)).toBe(true);
            const pid = Number(await readFile(ready, 'utf8'));
            controller.abort();
            const report = await execution;
            const result = report.results[0]!;
            await waitForExit(pid);
            expect(result).toMatchObject({
                status: 'failed',
                note: 'sandbox/fixer was canceled.',
                changed: ['source.txt'],
            });
            expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('partial');
        } finally {
            controller.abort();
            await execution;
        }
        delete session.cancelSignal;
        const correctedRun = await runFixers(
            session,
            [planFixer(session, buildProgramCommand('fakes/tool', '--write', 'source.txt=corrected'))],
            {
                isDryRun: false,
            },
        );
        const corrected = correctedRun.results[0]!;
        expect(corrected.status).toBe('changed');
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
    },
);
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function buildSourceDiff(after: string): string {
    return `===================================================================\n--- a/source.txt\n+++ b/source.txt\n@@ -1,1 +1,1 @@\n-original\n\\ No newline at end of file\n+${after}\n\\ No newline at end of file\n`;
}
