import { join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { existsSync, readFileSync } from 'node:fs';
import { runFixer } from '#cli/execution/fixers.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { waitForExit } from '#tests/support/cli/process.ts';
import { prepareCommand, runToolCheck } from '#cli/execution/tool-runner.ts';
import { CORRECTION_POLICY, plannedCorrection } from '#tests/support/cli/correction.ts';

test('splits 20,000 correction paths without losing or reordering arguments', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await plannedCorrection(session, 'process.exitCode = 0');
    const source = planned.files[0];
    if (source === undefined) throw new Error('The sandbox has no selected source.');
    const paths = Array.from({ length: 20_000 }, (_, index) => `long folder/café/${String(index)}/source.txt`);
    const files = paths.map((path) => ({ ...source, path }));
    const prepared = prepareCommand(session, { ...planned, files }, ['tool', '{files}'], process.execPath);
    expect(prepared.commands.length).toBeGreaterThan(1);
    expect(prepared.commands.flatMap((command) => command.argv.slice(1))).toStrictEqual(paths);
    for (const command of prepared.commands) expect(Buffer.byteLength(command.argv.join(' '))).toBeLessThan(100_000);
});

test('Correction environment paths expand against the execution root', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': CORRECTION_POLICY,
        'source.txt': 'original',
        'café settings.txt': 'corrected',
    });
    const session = await openSession(sandbox.path);
    const planned = await plannedCorrection(
        session,
        "await Bun.write('source.txt', await Bun.file(process.env['SANDBOX_SETTINGS']).text())",
    );
    planned.spec.env = { SANDBOX_SETTINGS: '{root}/café settings.txt' };
    const result = await runFixer(session, planned, sandbox.path);
    expect(result.status).toBe('changed');
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
});

test('a failed version probe blocks a check and its correction without changing source bytes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': CORRECTION_POLICY, 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = await plannedCorrection(session, "await Bun.write('source.txt', 'changed')");
    planned.tool = {
        name: 'version-teller',
        version: '3.8.1',
        windows: true,
        installers: {},
        version_command: ['-e', 'console.log("3.8.1"); process.exitCode = 7;'],
    };
    planned.spec.fix_command![0] = 'version-teller';
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
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

test.each(['canceled', 'timeout'].flatMap((failure) => [false, true].map((isolated) => ({ failure, isolated }))))(
    'a $failure correction retains partial changes and reports the process failure (isolated $isolated)',
    async ({ failure, isolated }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `${CORRECTION_POLICY}\n[limits]\ntool_seconds = 1\n`,
            'source.txt': 'original',
        });
        const session = await openSession(sandbox.path);
        const controller = new AbortController();
        const ready = join(sandbox.path, 'ready.pid');
        const planned = await plannedCorrection(
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
            if (failure === 'canceled') controller.abort();
            const result = await execution;
            await waitForExit(pid);
            expect(result.status).toBe('failed');
            if (result.status !== 'failed') throw new Error('The correction did not report its process failure.');
            expect(result.note).toContain(failure === 'canceled' ? 'was canceled' : 'ran past 1 seconds');
            expect(result.changed).toStrictEqual(['source.txt']);
            expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('partial');
        } finally {
            controller.abort();
            await execution;
        }
        const corrected = await runFixer(
            session,
            await plannedCorrection(session, "await Bun.write('source.txt', 'corrected')"),
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
        'gspot.toml': `version = 1
configurations = []
[[check]]
name = "project/inventory"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = process.argv.includes("added.txt") ? 0 : 1', '{files}'])}
fix_command = ${JSON.stringify([process.execPath, '-e', 'await Bun.write("added.txt", "created")'])}
fix_order = "codemod"
`,
    });
    const session = await openSession(sandbox.path);
    const options = { stage: 'commit' as const, skips: [], fix: true, isDryRun: false, noCache: true };
    const outcome = await executeRun(session, options);
    expect(outcome.report.exitCode).toBe(0);
    expect(outcome.report.checks[0]!.files).toBe(2);
    expect(session.repository.files.map((file) => file.path)).toContain('added.txt');
});
