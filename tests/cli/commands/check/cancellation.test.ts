// Bun cancellation probes require POSIX signals so handlers can finish and dispose their children.
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { git, gitOutput } from '#tests/harness/git.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { READY_POLL_MS } from '#tests/config/harness/process.ts';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { remainingTestTime, prepareTestCommand } from '#tests/harness/command.ts';
import { gspot, runGspot, startGspot, checkReport } from '#tests/harness/gspot.ts';
import { waitForExit, waitForFile, captureChild } from '#tests/harness/process.ts';
import type { CopyMarker, FakeGitOptions } from '#tests/types/cli/commands/cancellation.ts';
import { SLOW_CHECK, CHILD_OPTIONS, SLOW_TOOL_PROGRAM } from '#tests/config/cli/commands/check/cancellation.ts';

// A readiness file can become visible before the child has finished writing its JSON.
async function waitForJson(path: string): Promise<unknown> {
    const deadline = performance.now() + remainingTestTime();
    for (;;) {
        try {
            return JSON.parse(await readFile(path, 'utf8')) as unknown;
        } catch (error) {
            if (performance.now() >= deadline) throw error;
        }
        await Bun.sleep(READY_POLL_MS);
    }
}

// Both cancellation probes pause the selected Git call and delegate every other call to the real executable.
async function fakeGit(directory: string, options: FakeGitOptions): Promise<Record<string, string>> {
    const script = `#!${process.execPath}
const args = process.argv.slice(2);
if (args[0] === ${JSON.stringify(options.operation)}) {
    const counter = Bun.file(${JSON.stringify(join(directory, 'calls.txt'))});
    const count = (await counter.exists() ? Number(await counter.text()) : 0) + 1;
    await Bun.write(counter, String(count));
    if (count === ${String(options.pauseOnCall)}) {
        const checkout = args[0] === 'clone' ? args.at(-1) : args[0] === 'cat-file' ? process.cwd() : undefined;
        await Bun.write(${JSON.stringify(options.marker)}, JSON.stringify({pid: process.pid, checkout}));
        await Bun.sleep(60_000);
    }
}
const child = Bun.spawn([${JSON.stringify(options.executable)}, ...args], {stdin:'inherit', stdout:'inherit', stderr:'inherit'});
process.exit(await child.exited);
`;
    await writeFile(join(directory, 'git'), script, { mode: 0o755 });
    const environment = environmentVariables();
    return { ...environment, PATH: `${directory}${delimiter}${environment['PATH'] ?? ''}` };
}

test.skipIf(!isPosix).each(['SIGINT', 'SIGTERM'] as const)(
    'check propagates %s to an active tool and reports cancellation',
    async (signal) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], {
                tables: `[check."project/slow"]\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([process.execPath, '-e', SLOW_TOOL_PROGRAM])}\n`,
            }),
            'source.txt': 'input\n',
        });
        const child = startGspot(sandbox.path, SLOW_CHECK, {}, {});
        await using capture = captureChild(child);
        const started = join(sandbox.path, 'started.pid');
        expect(await waitForFile(started)).toBe(true);
        const toolPid = Number(await readFile(started, 'utf8'));
        child.kill(signal);
        expect(await child.exited, await capture.errors).toBe(2);
        const report = JSON.parse(await capture.output) as RunReport;
        expect(report.checks).toHaveLength(1);
        expect(report.checks[0]!.status).toBe('error');
        expect(report.checks[0]!.note).toContain('canceled');
        await waitForExit(toolPid);
    },
);

test.skipIf(!isPosix).each(['diff', 'clone', 'cat-file'] as const)(
    'staged cancellation during %s preserves source content and permits retry',
    async (operation) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
            'source.sh': 'echo indexed\n',
            scratch: {},
            bin: {},
        });
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        const indexed = git(sandbox.path, ['ls-files', '--stage', '-z']).stdout;
        const scratch = join(sandbox.path, 'scratch');
        await writeFile(join(sandbox.path, 'source.sh'), 'echo authored\n');
        const nativeGit = Bun.which('git');
        expect(nativeGit).not.toBeNull();
        const marker = join(sandbox.path, 'started.json');
        const bin = join(sandbox.path, 'bin');
        const environment = await fakeGit(bin, { operation, marker, pauseOnCall: 1, executable: nativeGit! });
        const child = startGspot(
            sandbox.path,
            ['check', '--staged', '--only', 'bash/bash-syntax', '--json'],
            {
                ...environment,
                TMPDIR: scratch,
            },
            {},
        );
        await using capture = captureChild(child);
        const started = (await waitForJson(marker)) as CopyMarker;
        if (operation === 'diff') expect(await readdir(scratch)).toStrictEqual([]);
        child.kill(operation === 'clone' ? 'SIGINT' : 'SIGTERM');
        expect(await child.exited, await capture.errors).toBe(2);
        expect(JSON.parse(await capture.output)).toStrictEqual({
            error: 'canceled',
            message: 'Check stopped before every check finished.',
            exitCode: 2,
        });
        await waitForExit(started.pid);
        if (operation !== 'diff') {
            expect(started.checkout).toBeDefined();
            expect(await pathExists(started.checkout!)).toBe(false);
        }
        expect(await readdir(scratch)).toStrictEqual([]);
        expect(git(sandbox.path, ['ls-files', '--stage', '-z']).stdout).toBe(indexed);
        expect(await readFile(join(sandbox.path, 'source.sh'), 'utf8')).toBe('echo authored\n');
        const retry = await checkReport(sandbox.path, ['check', '--staged', '--only', 'bash/bash-syntax', '--json']);
        expect(retry.code, retry.stdout + retry.stderr).toBe(0);
        expect(retry.report.checks[0]!.status).toBe('passed');
    },
);

test.skipIf(!isPosix)('push cancellation retains completed reports and names references not checked', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
        'source.sh': 'echo first\n',
    });
    for (const args of [
        ['init', '-q'],
        ['add', '-A'],
        ['commit', '-qm', 'feat: first'],
    ])
        gitOutput(sandbox.path, args);
    const first = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
    await writeFile(join(sandbox.path, 'source.sh'), 'echo second\n');
    expect(git(sandbox.path, ['commit', '-qam', 'feat: second']).code).toBe(0);
    const second = git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
    const marker = join(sandbox.path, 'started.json');
    const nativeGit = Bun.which('git');
    expect(nativeGit).not.toBeNull();
    const binaryDirectory = join(sandbox.path, 'bin');
    await mkdir(binaryDirectory);
    const protocol = `refs/heads/first ${first} refs/heads/first ${'0'.repeat(first.length)}\nrefs/heads/second ${second} refs/heads/second ${'0'.repeat(second.length)}\n`;
    const child = startGspot(
        sandbox.path,
        ['check', '--hook', 'pre-push', '--only', 'bash/bash-syntax', '--json'],
        await fakeGit(binaryDirectory, { operation: 'clone', marker, pauseOnCall: 2, executable: nativeGit! }),
        { stdin: protocol },
    );
    await using capture = captureChild(child);
    const { output, errors } = capture;
    const started = (await waitForJson(marker)) as Required<CopyMarker>;
    child.kill('SIGINT');
    expect(await child.exited, await errors).toBe(2);
    const report = JSON.parse(await output) as PushReport;
    expect(report).toMatchObject({
        revisions: [{ object: first, report: { checks: [{ status: 'passed' }] } }],
        canceled: { pendingRefs: ['refs/heads/second'] },
        exitCode: 2,
    });
    expect(await pathExists(started.checkout)).toBe(false);
    await waitForExit(started.pid);
    expect(git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim()).toBe(second);
});

test.skipIf(!isPosix).each(['SIGINT', 'SIGTERM'] as const)(
    'push cancellation while stdin remains open handles %s and permits retry',
    async (signal) => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
            'source.sh': 'echo indexed\n',
        });
        expect(git(root, ['init', '-q']).code).toBe(0);
        expect(git(root, ['add', '-A']).code).toBe(0);
        gitOutput(root, ['commit', '-qm', 'feat: push input']);
        const revision = gitOutput(root, ['rev-parse', 'HEAD']);
        const ref = gitOutput(root, ['symbolic-ref', 'HEAD']);
        const indexed = git(root, ['ls-files', '--stage', '-z']).stdout;
        const started = join(root, 'listening');
        const program = `
process.on('newListener',(name)=>{ if(name==='SIGTERM') setImmediate(()=>require('node:fs').writeFileSync(${JSON.stringify(started)},'ready')); });
process.argv=[process.execPath,${JSON.stringify(gspot)},'check','--hook', 'pre-push','--json'];
await import(${JSON.stringify(gspot)});
`;
        const command = [process.execPath, '-e', program];
        const prepared = prepareTestCommand(command, { cwd: root }, 'push input');
        const child = Bun.spawn(command, {
            cwd: root,
            stdin: 'pipe',
            ...CHILD_OPTIONS,
            timeout: prepared.options.timeoutMs,
        });
        await using capture = captureChild(child);
        const { output, errors } = capture;
        try {
            await child.stdin.write('refs/heads/incomplete ');
            await child.stdin.flush();
            expect(await waitForFile(started)).toBe(true);
            child.kill(signal);
            expect(await child.exited, await errors).toBe(2);
            expect(JSON.parse(await output)).toStrictEqual({
                error: 'canceled',
                message: 'Check stopped before every check finished.',
                exitCode: 2,
            });
            expect(git(root, ['ls-files', '--stage', '-z']).stdout).toBe(indexed);
            const protocol = `${ref} ${revision} ${ref} ${'0'.repeat(revision.length)}\n`;
            const retry = await runGspot(
                root,
                ['check', '--hook', 'pre-push', '--only', 'bash/bash-syntax', '--json'],
                {},
                { stdin: protocol },
            );
            expect(retry.code, retry.stdout + retry.stderr).toBe(0);
            expect((JSON.parse(retry.stdout) as PushReport).revisions).toMatchObject([
                {
                    object: revision,
                    refs: [ref],
                    report: { exitCode: 0, checks: [{ check: 'bash/bash-syntax', status: 'passed' }] },
                },
            ]);
        } finally {
            await child.stdin.end();
        }
    },
);
