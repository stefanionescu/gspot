import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { openSession } from '#cli/session.ts';
import { fakeTool } from '#tests/setup/fakes.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { runChecks } from '#cli/checks/run/run.ts';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { type PausedGit } from '#tests/types/processes.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { type PushReport } from '#cli/types/commands/check.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { type RunReport } from '#cli/types/checks/run/check.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { MILLISECONDS_PER_SECOND } from '#tests/data/test-setup.ts';
import { SLOW_TOOL_PROGRAM } from '#tests/data/runs/command-checks.ts';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { BASH_SYNTAX_CHECK } from '#tests/data/checks/bash/tool-checks.ts';
import { CLI_MAIN, runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { waitForExit, waitForFile, captureChild, startCommand, prepareCommand } from '#tests/setup/processes.ts';

// Windows does not deliver these process signals like POSIX systems.
test.skipIf(isWindows).each(['SIGINT', 'SIGTERM'] as const)(
    'check passes %s to a running tool and reports the run as canceled',
    async (signal) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText([], {
                tables: `[[command_check]]\nname = "project/slow"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([process.execPath, '-e', SLOW_TOOL_PROGRAM])}\n`,
            }),
            'source.txt': 'input\n',
        });
        await using capture = startCommand([process.execPath, CLI_MAIN, 'check', '--only', 'project/slow', '--json'], {
            cwd: sandbox.path,
            env: { ...buildSpawnEnvironment(), NO_COLOR: '1', CI: '1' },
        });
        const { child } = capture;
        const started = join(sandbox.path, 'started.pid');
        expect(await waitForFile(started)).toBe(true);
        const toolPid = Number(await readFile(started, 'utf8'));
        child.kill(signal);
        expect(await child.exited, await capture.errors).toBe(signal === 'SIGINT' ? 130 : 143);
        const report = JSON.parse(await capture.output) as RunReport;
        expect(report.exitCode).toBe(signal === 'SIGINT' ? 130 : 143);
        expect(report.checks).toHaveLength(1);
        expect(report.checks[0]!.status).toBe('error');
        expect(report.checks[0]!.note).toContain('canceled');
        await waitForExit(toolPid);
    },
);

// A fake git that pauses on the chosen call and passes every other call to the real git.
async function fakeGit(
    folder: string,
    options: { operation: 'diff' | 'clone' | 'cat-file'; marker: string; pauseOnCall: number; executable: string },
): Promise<Record<string, string>> {
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
const child = Bun.spawn([${JSON.stringify(options.executable)}, ...args], {stdin:'inherit', stdout:'inherit', stderr:'inherit'});
process.exit(await child.exited);
`;
    await fakeTool(folder, 'git', script);
    const environment = buildSpawnEnvironment();
    return { ...environment, PATH: `${folder}${delimiter}${environment['PATH'] ?? ''}` };
}

// Windows does not deliver these process signals like POSIX systems.
test.skipIf(isWindows).each(['diff', 'clone', 'cat-file'] as const)(
    'staged cancellation during %s preserves source content and permits retry',
    async (operation) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['bash'], { tables: BASH_SYNTAX_CHECK }),
            'source.sh': 'echo indexed\n',
            scratch: {},
            bin: {},
        });
        readGitOutput(sandbox.path, ['init', '-q']);
        readGitOutput(sandbox.path, ['add', '-A']);
        const indexed = readGitOutput(sandbox.path, ['ls-files', '--stage', '-z']);
        const scratch = join(sandbox.path, 'scratch');
        await writeFile(join(sandbox.path, 'source.sh'), 'echo authored\n');
        const nativeGit = Bun.which('git');
        expect(nativeGit).not.toBeNull();
        const marker = join(sandbox.path, 'started.json');
        const bin = join(sandbox.path, 'bin');
        const environment = await fakeGit(bin, { operation, marker, pauseOnCall: 1, executable: nativeGit! });
        await using capture = startCommand(
            [process.execPath, CLI_MAIN, 'check', '--staged', '--only', 'project/bash-syntax', '--json'],
            {
                cwd: sandbox.path,
                env: { ...buildSpawnEnvironment(), NO_COLOR: '1', CI: '1', ...environment, TMPDIR: scratch },
            },
        );
        const { child } = capture;
        expect(await waitForFile(marker)).toBe(true);
        const started = JSON.parse(await readFile(marker, 'utf8')) as PausedGit;
        if (operation === 'diff') expect(await readdir(scratch)).toStrictEqual([]);
        child.kill(operation === 'clone' ? 'SIGINT' : 'SIGTERM');
        expect(await child.exited, await capture.errors).toBe(operation === 'clone' ? 130 : 143);
        expect(JSON.parse(await capture.output)).toStrictEqual({
            error: 'canceled',
            message: 'Check stopped before every check finished.',
            exitCode: operation === 'clone' ? 130 : 143,
        });
        await waitForExit(started.pid);
        if (operation !== 'diff') {
            expect(started.checkout).toBeDefined();
            expect(await isOnDisk(started.checkout!)).toBe(false);
        }
        expect(await readdir(scratch)).toStrictEqual([]);
        expect(readGitOutput(sandbox.path, ['ls-files', '--stage', '-z'])).toBe(indexed);
        expect(await readFile(join(sandbox.path, 'source.sh'), 'utf8')).toBe('echo authored\n');
        const retry = await checkReport(sandbox.path, ['check', '--staged', '--only', 'project/bash-syntax', '--json']);
        expect(retry.code, retry.stdout + retry.stderr).toBe(0);
        expect(retry.report.checks[0]!.status).toBe('passed');
    },
);

// Windows does not deliver these process signals like POSIX systems.
test.skipIf(isWindows)('push cancellation retains completed reports and names references not checked', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'source.sh': 'echo first\n',
    });
    commitAll(sandbox.path);
    const first = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    await writeFile(join(sandbox.path, 'source.sh'), 'echo second\n');
    readGitOutput(sandbox.path, ['commit', '-qam', 'feat: second']);
    const second = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const marker = join(sandbox.path, 'started.json');
    const nativeGit = Bun.which('git');
    expect(nativeGit).not.toBeNull();
    const binaryFolder = join(sandbox.path, 'bin');
    await mkdir(binaryFolder);
    const protocol = `refs/heads/first ${first} refs/heads/first ${'0'.repeat(first.length)}\nrefs/heads/second ${second} refs/heads/second ${'0'.repeat(second.length)}\n`;
    await using capture = startCommand(
        [process.execPath, CLI_MAIN, 'check', '--hook', 'pre-push', '--only', 'project/bash-syntax', '--json'],
        {
            cwd: sandbox.path,
            env: {
                ...buildSpawnEnvironment(),
                NO_COLOR: '1',
                CI: '1',
                ...(await fakeGit(binaryFolder, {
                    operation: 'clone',
                    marker,
                    pauseOnCall: 2,
                    executable: nativeGit!,
                })),
            },
            stdin: protocol,
        },
    );
    const { child } = capture;
    const { output, errors } = capture;
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
            'gspot.toml': buildSettingsText(['bash'], { tables: BASH_SYNTAX_CHECK }),
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
        'gspot.toml': buildSettingsText([], {
            tables: `[[command_check]]\nname = "project/cancel"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([process.execPath, '-e', program])}\n`,
        }),
        'source.txt': 'Input.\n',
    });
    const controller = new AbortController();
    const session = await openSession(sandbox.path);
    using _resources = session.resources;
    const running = runChecks(
        { ...session, cancelSignal: controller.signal },
        buildRunOptions({ only: ['project/cancel'] }),
    );
    expect(await waitForFile(marker)).toBe(true);
    controller.abort();
    const result = await running;
    expect(result.report.checks).toMatchObject([{ check: 'project/cancel', status: 'error' }]);
    expect(result.report.checks[0]?.note).toContain('canceled');
    await waitForExit(Number(await Bun.file(marker).text()));
});
