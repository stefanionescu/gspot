import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { type PausedGit } from '#tests/types/processes.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import { type PushReport } from '#cli/types/commands/check.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/runs/command.ts';
import { writeScriptCommand } from '#tests/setup/system/fakes.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { SLOW_TOOL_SCRIPT } from '#tests/config/commands/check/cancellation.ts';
import { CLI_BIN, CLI_MAIN, runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    waitForExit,
    waitForFile,
    captureChild,
    startCommand,
    limitToTestDeadline,
} from '#tests/setup/system/processes.ts';

async function prepareStagedCancellation(root: string, operation: 'diff' | 'clone' | 'cat-file') {
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'source.sh': 'echo indexed\n',
        scratch: {},
        bin: {},
    });
    runGitStep(root, ['init', '-q']);
    runGitStep(root, ['add', '-A']);
    const indexed = runGitStep(root, ['ls-files', '--stage', '-z']);
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

async function assertStagedRetry(
    root: string,
    paused: Pick<Awaited<ReturnType<typeof prepareStagedCancellation>>, 'scratch' | 'indexed'>,
): Promise<void> {
    expect(await readdir(paused.scratch)).toStrictEqual([]);
    expect(runGitStep(root, ['ls-files', '--stage', '-z'])).toBe(paused.indexed);
    expect(await readFile(join(root, 'source.sh'), 'utf8')).toBe('echo authored\n');
    const retry = parseCheckReport(
        await runGspot(root, ['check', '--staged', '--only', 'project/bash-syntax', '--json']),
    );
    expect(retry.code, retry.stdout + retry.stderr).toBe(0);
    expect(retry.report.checks[0]!.status).toBe('passed');
}

test.skipIf(isWindows).each(['SIGINT', 'SIGTERM'] as const)(
    'check passes %s to a running tool and reports the run as canceled',
    async (signal) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([], {
                tables: stringify({
                    command_check: [
                        {
                            id: 'project/slow',
                            stage: 'commit',
                            paths: ['source.txt'],
                            command: [process.execPath, '-e', SLOW_TOOL_SCRIPT],
                        },
                    ],
                }),
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
        expect(report.checks).toMatchObject([
            { check: 'project/slow', status: 'error', note: `${process.execPath} was canceled.` },
        ]);
        await waitForExit(toolPid);
    },
);

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

test.skipIf(isWindows)(
    'canceling a pre-push check keeps the finished reports and names the refs it did not check',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
            'source.sh': 'echo first\n',
        });

        commitAll(sandbox.path);
        const first = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
        await writeFile(join(sandbox.path, 'source.sh'), 'echo second\n');
        runGitStep(sandbox.path, ['commit', '-qam', 'feat: second']);
        const second = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
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
        expect(runGitStep(sandbox.path, ['rev-parse', 'HEAD'])).toBe(second);
    },
);

test.skipIf(isWindows).each(['SIGINT', 'SIGTERM'] as const)(
    'canceling a pre-push check with %s while its stdin is open exits with the signal code, keeps the index, and a second run passes',
    async (signal) => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
            'source.sh': 'echo indexed\n',
        });
        commitAll(root);
        const revision = runGitStep(root, ['rev-parse', 'HEAD']);
        const ref = runGitStep(root, ['symbolic-ref', 'HEAD']);
        const indexed = runGitStep(root, ['ls-files', '--stage', '-z']);
        const started = join(root, 'listening');
        const program = `
process.on('newListener',(name)=>{ if(name==='SIGTERM') setImmediate(()=>require('node:fs').writeFileSync(${JSON.stringify(started)},'ready')); });
process.argv=[process.execPath,${JSON.stringify(CLI_MAIN)},'check','--hook', 'pre-push','--json'];
const {runProgram} = await import(${JSON.stringify(CLI_MAIN)});
process.exitCode = await runProgram(process.argv.slice(2));
`;
        const command = [process.execPath, '-e', program];
        const limited = limitToTestDeadline(command, { cwd: root });
        const child = Bun.spawn(command, {
            cwd: root,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
            timeout: Math.ceil(limited.options.timeoutSeconds * MILLISECONDS_PER_SECOND),
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
            expect(runGitStep(root, ['ls-files', '--stage', '-z'])).toBe(indexed);
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

async function fakePausingGit(
    folder: string,
    options: { operation: 'diff' | 'clone' | 'cat-file'; marker: string; pauseOnCall: number },
): Promise<Record<string, string>> {
    const executable = Bun.which('git');
    if (executable === null) throw new Error('The pausing Git fake requires Git on PATH.');
    const script = `
const args = process.argv.slice(2);
if (args[0] === ${JSON.stringify(options.operation)}) {
    const counter = Bun.file(${JSON.stringify(join(folder, 'calls.txt'))});
    const count = (await counter.exists() ? Number(await counter.text()) : 0) + 1;
    await Bun.write(counter, String(count));
    if (count === ${String(options.pauseOnCall)}) {
        const checkout = args[0] === 'clone' ? args.at(-1) : args[0] === 'cat-file' ? process.cwd() : undefined;
        const marker = ${JSON.stringify(options.marker)};
        await Bun.write(marker + ".tmp", JSON.stringify({pid: process.pid, checkout}));
        await (await import("node:fs/promises")).rename(marker + ".tmp", marker);
        await Bun.sleep(60_000);
    }
}

const child = Bun.spawn([${JSON.stringify(executable)}, ...args], {stdin:'inherit', stdout:'inherit', stderr:'inherit'});
process.exit(await child.exited);
`;
    await writeScriptCommand(folder, 'git', script);
    const environment = buildSpawnEnvironment();
    return { ...environment, PATH: `${folder}${delimiter}${environment['PATH'] ?? ''}` };
}
