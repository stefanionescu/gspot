import executables from 'which';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { CHECKS } from '#cli/checks/registry.ts';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { runFixer } from '#cli/execution/fixers.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { waitForExit } from '#tests/harness/cli/process.ts';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import { CORRECTION_POLICY, plannedCorrection } from '#tests/harness/cli/correction.ts';

test('Correction environment paths expand against the execution root', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': CORRECTION_POLICY,
        'source.txt': 'original',
        'café settings.txt': 'corrected',
    });
    const session = await openSession(sandbox.path);
    const planned = plannedCorrection(
        session,
        "await Bun.write('source.txt', await Bun.file(process.env['SANDBOX_SETTINGS']).text())",
    );
    planned.spec.env = { SANDBOX_SETTINGS: '{root}/café settings.txt' };
    const result = await runFixer(session, planned, sandbox.path);
    expect(result.status).toBe('changed');
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
});

test('a failed version inspection blocks a check and its correction without changing source bytes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = plannedCorrection(session, "await Bun.write('source.txt', 'changed')");
    planned.tool = {
        name: 'version-teller',
        version: '3.8.1',
        installers: {},
        version_command: ['-e', 'console.log("3.8.1"); process.exitCode = 7;'],
    };
    planned.spec.fix_command![0] = 'version-teller';
    const which = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    try {
        const checked = await runToolCheck(session, planned);
        expect(checked.status).toBe('error');
        expect(checked.note).toContain('exited 7');
        const fixed = await runFixer(session, planned, sandbox.path);
        expect(fixed.status).toBe('failed');
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    } finally {
        which.mockRestore();
    }
});

test.each([false, true])(
    'a canceled correction retains partial changes and reports the process failure (isolated %p)',
    async (isolated) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': CORRECTION_POLICY,
            'source.txt': 'original',
        });
        const session = await openSession(sandbox.path);
        const controller = new AbortController();
        const ready = join(sandbox.path, 'ready.pid');
        const planned = plannedCorrection(
            session,
            `await Bun.write('source.txt', 'partial'); await Bun.write(${JSON.stringify(ready)}, String(process.pid)); await Bun.sleep(10000);`,
        );
        planned.spec.isolated_files = isolated;
        const execution = runFixer({ ...session, cancelSignal: controller.signal }, planned, sandbox.path);
        try {
            const readyDeadline = performance.now() + 2000;
            while (!existsSync(ready) && performance.now() < readyDeadline) await Bun.sleep(10);
            expect(existsSync(ready)).toBe(true);
            const pid = Number(readFileSync(ready, 'utf8'));
            expect(pid).toBeGreaterThan(0);
            controller.abort();
            const result = await execution;
            await waitForExit(pid);
            expect(result.status).toBe('failed');
            if (result.status !== 'failed') throw new Error('The correction did not report its process failure.');
            expect(result.note).toContain('was canceled');
            expect(result.changed).toStrictEqual(['source.txt']);
            expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('partial');
        } finally {
            controller.abort();
            await execution;
        }
        const corrected = await runFixer(
            session,
            plannedCorrection(session, "await Bun.write('source.txt', 'corrected')"),
            sandbox.path,
        );
        expect(corrected.status).toBe('changed');
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
    },
);

test('checks refresh the file inventory after a fixer creates a source', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.txt': 'input',
        'gspot.toml': `kits = []
[[check]]
name = "project/inventory"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = process.argv.includes("added.txt") ? 0 : 1', '{files}'])}
fix_command = ${JSON.stringify([process.execPath, '-e', 'await Bun.write("added.txt", "created")'])}
`,
    });
    const session = await openSession(sandbox.path);
    const options = { stage: 'commit' as const, skips: [], fix: true, isDryRun: false };
    const outcome = await executeRun(session, { ...options, checks: CHECKS });
    expect(outcome.report.exitCode).toBe(0);
    expect(outcome.report.checks[0]!.files).toBe(2);
    expect(session.repository.files.map((file) => file.path)).toContain('added.txt');
});

// A check that fails while a file holds its first argument, and a correction that replaces that text with its second.
const TEXT_CHECK =
    'const [, text, ...paths] = process.argv; const bodies = await Promise.all(paths.map((path) => Bun.file(path).text())); process.exitCode = bodies.some((body) => body.includes(text)) ? 1 : 0;';
const TEXT_FIX =
    'const [, text, replacement, ...paths] = process.argv; for (const path of paths) await Bun.write(path, (await Bun.file(path).text()).replaceAll(text, replacement));';

test('a later pass formats what a correction after the formatter wrote', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.txt': 'var x\n',
        'gspot.toml': `kits = []
[[check]]
name = "project/format"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', TEXT_CHECK, '  ', '{files}'])}
fix_command = ${JSON.stringify([process.execPath, '-e', TEXT_FIX, '  ', ' ', '{files}'])}
[[check]]
name = "project/codemod"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', TEXT_CHECK, 'var', '{files}'])}
fix_command = ${JSON.stringify([process.execPath, '-e', TEXT_FIX, 'var', 'let ', '{files}'])}
`,
    });
    const options = { stage: 'commit' as const, skips: [], fix: true, isDryRun: false };
    const outcome = await executeRun(await openSession(sandbox.path), { ...options, checks: CHECKS });
    expect(outcome.report.exitCode, JSON.stringify(outcome.report.checks)).toBe(0);
    expect(outcome.fixes?.results).toMatchObject([
        { check: 'project/format', status: 'changed', changed: ['source.txt'] },
        { check: 'project/codemod', status: 'changed', changed: ['source.txt'] },
    ]);
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('let x\n');
});
