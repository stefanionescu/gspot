import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { fakePausingGit } from '#tests/setup/fakes.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { type PausedGit } from '#tests/types/processes.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import { type PushReport } from '#cli/types/commands/check.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { SLOW_TOOL_PROGRAM } from '#tests/data/runs/command-checks.ts';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { BASH_SYNTAX_CHECK } from '#tests/data/checks/bash/tool-checks.ts';
import { CLI_BIN, runGspot, CLI_MAIN, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { waitForExit, waitForFile, captureChild, startCommand, prepareCommand } from '#tests/setup/processes.ts';

/** Start a staged check with indexed input, an authored edit, and a paused Git command. */
async function prepareStagedCancellation(root: string, operation: 'diff' | 'clone' | 'cat-file') {
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'source.sh': 'echo indexed\n',
        scratch: {},
        bin: {},
    });
    readGitOutput(root, ['init', '-q']);
    readGitOutput(root, ['add', '-A']);
    const indexed = readGitOutput(root, ['ls-files', '--stage', '-z']);
    await writeFile(join(root, 'source.sh'), 'echo authored\n');
    const marker = join(root, 'started.json');
    const environment = await fakePausingGit(join(root, 'bin'), { operation, marker, pauseOnCall: 1 });
    const scratch = join(root, 'scratch');
    await using resources = new AsyncDisposableStack();
    const capture = resources.use(
        startCommand([process.execPath, CLI_BIN, 'check', '--staged', '--only', 'project/bash-syntax', '--json'], {
            cwd: root,
            env: { ...buildSpawnEnvironment(), NO_COLOR: '1', CI: '1', ...environment, TMPDIR: scratch },
        }),
    );
    expect(await waitForFile(marker)).toBe(true);
    const started = JSON.parse(await readFile(marker, 'utf8')) as PausedGit;
    const owned = resources.move();
    return { ...capture, indexed, scratch, started, [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned) };
}

/** Stop the paused check and verify its public cancellation response before waiting for Git to exit. */
async function stopStagedCancellation(
    paused: Awaited<ReturnType<typeof prepareStagedCancellation>>,
    signal: 'SIGINT' | 'SIGTERM',
    exitCode: number,
): Promise<void> {
    paused.child.kill(signal);
    expect(await paused.child.exited, await paused.errors).toBe(exitCode);
    expect(JSON.parse(await paused.output)).toStrictEqual({
        error: 'canceled',
        message: 'Check stopped before every check finished.',
        exitCode,
    });
    await waitForExit(paused.started.pid);
}

/** Verify the retained working tree and index, then run the same staged check successfully. */
async function assertStagedRetry(
    root: string,
    paused: Pick<Awaited<ReturnType<typeof prepareStagedCancellation>>, 'scratch' | 'indexed'>,
): Promise<void> {
    expect(await readdir(paused.scratch)).toStrictEqual([]);
    expect(readGitOutput(root, ['ls-files', '--stage', '-z'])).toBe(paused.indexed);
    expect(await readFile(join(root, 'source.sh'), 'utf8')).toBe('echo authored\n');
    const retry = parseCheckReport(
        await runGspot(root, ['check', '--staged', '--only', 'project/bash-syntax', '--json']),
    );
    expect(retry.code, retry.stdout + retry.stderr).toBe(0);
    expect(retry.report.checks[0]!.status).toBe('passed');
}

// Windows does not deliver these process signals like POSIX systems.
test.skipIf(isWindows).each(['SIGINT', 'SIGTERM'] as const)(
    'check passes %s to a running tool and reports the run as canceled',
    async (signal) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([], {
                tables: `[[command_check]]\nid = "project/slow"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([process.execPath, '-e', SLOW_TOOL_PROGRAM])}\n`,
            }),
            'source.txt': 'input\n',
        });

        await using capture = startCommand([process.execPath, CLI_BIN, 'check', '--only', 'project/slow', '--json'], {
            cwd: sandbox.path,
            env: { ...buildSpawnEnvironment(), NO_COLOR: '1', CI: '1' },
        });
        const { child } = capture;
        const started = join(sandbox.path, 'started.pid');
        expect(await waitForFile(started)).toBe(true);
        const toolPid = Number(await readFile(started, 'utf8'));
        child.kill(signal);
        expect(await child.exited, await capture.errors).toBe(signal === 'SIGINT' ? 130 : 143);
        const report = parseCheckReport({
            code: await child.exited,
            stdout: await capture.output,
            stderr: await capture.errors,
        }).report;
        expect(report.exitCode).toBe(signal === 'SIGINT' ? 130 : 143);
        expect(report.checks).toHaveLength(1);
        expect(report.checks[0]!.status).toBe('error');
        expect(report.checks[0]!.note).toContain('canceled');
        await waitForExit(toolPid);
    },
);

// Windows does not deliver these process signals like POSIX systems.
test.skipIf(isWindows)(
    'canceling check --staged during git diff exits with the signal code, keeps the index and the working file, and a second run passes',
    async () => {
        await using sandbox = await testdir();
        await using paused = await prepareStagedCancellation(sandbox.path, 'diff');
        expect(await readdir(paused.scratch)).toStrictEqual([]);
        await stopStagedCancellation(paused, 'SIGTERM', 143);
        await assertStagedRetry(sandbox.path, paused);
    },
);

test.skipIf(isWindows).each([
    { operation: 'clone', signal: 'SIGINT', exitCode: 130 },
    { operation: 'cat-file', signal: 'SIGTERM', exitCode: 143 },
] as const)(
    'canceling check --staged during git $operation exits with the signal code, keeps the index and the working file, and a second run passes',
    async ({ operation, signal, exitCode }) => {
        await using sandbox = await testdir();
        await using paused = await prepareStagedCancellation(sandbox.path, operation);
        await stopStagedCancellation(paused, signal, exitCode);
        expect(paused.started.checkout).toBeDefined();
        expect(await isOnDisk(paused.started.checkout!)).toBe(false);
        await assertStagedRetry(sandbox.path, paused);
    },
);

// Windows does not deliver these process signals like POSIX systems.
test.skipIf(isWindows)('push cancellation retains completed reports and names references not checked', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'source.sh': 'echo first\n',
    });

    commitAll(sandbox.path);
    const first = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    await writeFile(join(sandbox.path, 'source.sh'), 'echo second\n');
    readGitOutput(sandbox.path, ['commit', '-qam', 'feat: second']);
    const second = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const marker = join(sandbox.path, 'started.json');
    const binaryFolder = join(sandbox.path, 'bin');
    await mkdir(binaryFolder);
    const protocol = `refs/heads/first ${first} refs/heads/first ${'0'.repeat(first.length)}\nrefs/heads/second ${second} refs/heads/second ${'0'.repeat(second.length)}\n`;
    await using capture = startCommand(
        [process.execPath, CLI_BIN, 'check', '--hook', 'pre-push', '--only', 'project/bash-syntax', '--json'],
        {
            cwd: sandbox.path,
            env: {
                ...buildSpawnEnvironment(),
                NO_COLOR: '1',
                CI: '1',
                ...(await fakePausingGit(binaryFolder, {
                    operation: 'clone',
                    marker,
                    pauseOnCall: 2,
                })),
            },
            stdin: protocol,
        },
    );
    const { child, output, errors } = capture;
    expect(await waitForFile(marker)).toBe(true);
    const started = JSON.parse(await readFile(marker, 'utf8')) as Required<PausedGit>;
    child.kill('SIGINT');
    expect(await child.exited, await errors).toBe(130);
    const report = JSON.parse(await output) as PushReport;
    expect(report).toMatchObject({
        revisions: [{ hash: first, report: { checks: [{ status: 'passed' }] } }],
        canceled: { pendingRefs: ['refs/heads/second'] },
        exitCode: 130,
    });
    expect(await isOnDisk(started.checkout)).toBe(false);
    await waitForExit(started.pid);
    expect(readGitOutput(sandbox.path, ['rev-parse', 'HEAD'])).toBe(second);
});

// Windows does not deliver these process signals like POSIX systems.
test.skipIf(isWindows).each(['SIGINT', 'SIGTERM'] as const)(
    'push cancellation while stdin remains open handles %s and permits retry',
    async (signal) => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
            'source.sh': 'echo indexed\n',
        });
        commitAll(root);
        const revision = readGitOutput(root, ['rev-parse', 'HEAD']);
        const ref = readGitOutput(root, ['symbolic-ref', 'HEAD']);
        const indexed = readGitOutput(root, ['ls-files', '--stage', '-z']);
        const started = join(root, 'listening');
        const program = `
process.on('newListener',(name)=>{ if(name==='SIGTERM') setImmediate(()=>require('node:fs').writeFileSync(${JSON.stringify(started)},'ready')); });
process.argv=[process.execPath,${JSON.stringify(CLI_MAIN)},'check','--hook', 'pre-push','--json'];
const {runProgram} = await import(${JSON.stringify(CLI_MAIN)});
process.exitCode = await runProgram(process.argv.slice(2));
`;
        const command = [process.execPath, '-e', program];
        const prepared = prepareCommand(command, { cwd: root });
        const child = Bun.spawn(command, {
            cwd: root,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
            timeout: Math.ceil(prepared.options.timeoutSeconds * MILLISECONDS_PER_SECOND),
        });
        await using capture = captureChild(child);
        const { output, errors } = capture;
        try {
            await child.stdin.write('refs/heads/incomplete ');
            await child.stdin.flush();
            expect(await waitForFile(started)).toBe(true);
            child.kill(signal);
            expect(await child.exited, await errors).toBe(signal === 'SIGINT' ? 130 : 143);
            expect(JSON.parse(await output)).toStrictEqual({
                error: 'canceled',
                message: 'Check stopped before every check finished.',
                exitCode: signal === 'SIGINT' ? 130 : 143,
            });
            expect(readGitOutput(root, ['ls-files', '--stage', '-z'])).toBe(indexed);
            const protocol = `${ref} ${revision} ${ref} ${'0'.repeat(revision.length)}\n`;
            const retry = await runGspot(
                root,
                ['check', '--hook', 'pre-push', '--only', 'project/bash-syntax', '--json'],
                {},
                { stdin: protocol },
            );
            expect(retry.code, retry.stdout + retry.stderr).toBe(0);
            expect((JSON.parse(retry.stdout) as PushReport).revisions).toMatchObject([
                {
                    hash: revision,
                    refs: [ref],
                    report: { exitCode: 0, checks: [{ check: 'project/bash-syntax', status: 'passed' }] },
                },
            ]);
        } finally {
            await child.stdin.end();
        }
    },
);

test('an aborted run stops its command and reports cancellation on every system', async () => {
    await using sandbox = await testdir();
    const marker = join(sandbox.path, 'command-ready');
    const program = `await Bun.write(${JSON.stringify(marker)}, String(process.pid)); setInterval(() => {}, 1000);`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            tables: `[[command_check]]\nid = "project/cancel"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([process.execPath, '-e', program])}\n`,
        }),
        'source.txt': 'Input.\n',
    });
    const controller = new AbortController();
    const session = await openSession(sandbox.path);
    using _resources = session.resources;
    session.cancelSignal = controller.signal;
    const running = runChecks(session, buildRunOptions({ only: ['project/cancel'] }));
    expect(await waitForFile(marker)).toBe(true);
    controller.abort();
    const result = await running;
    expect(result.report.checks).toMatchObject([{ check: 'project/cancel', status: 'error' }]);
    expect(result.report.checks[0]?.note).toContain('canceled');
    await waitForExit(Number(await readFile(marker, 'utf8')));
});
