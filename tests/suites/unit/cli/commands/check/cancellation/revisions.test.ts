import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { pushOutputSchema } from '#tests/schemas/setup.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import type { PausedGit, ProcessOutput } from '#tests/types/setup.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { SIGNAL_EXITS, AUTHORED_SCRIPT } from '#tests/config/commands/check.ts';
import { buildProgramCommand, writeProgramCommand } from '#tests/setup/system/programs.ts';
import { BASH_SYNTAX_CHECK, BASH_SYNTAX_PUSH_CHECK } from '#tests/config/setup/sandboxes.ts';
import { SIGNAL_MARKER_OPTION, CHILD_TIMEOUT_SECONDS } from '#tests/config/setup/programs.ts';
import { waitForExit, waitForFile, captureChild, limitCommand } from '#tests/setup/system/processes.ts';

async function prepareStagedCancellation(root: string): Promise<{ indexed: string; scratch: string }> {
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'source.sh': 'echo indexed\n',
        scratch: {},
    });
    runGitStep(root, ['init', '-q']);
    runGitStep(root, ['add', '-A']);
    const indexed = runGitStep(root, ['ls-files', '--stage', '-z']);
    await writeFile(join(root, 'source.sh'), AUTHORED_SCRIPT);
    return { indexed, scratch: join(root, 'scratch') };
}

/**
Send the signal once the pausing Git fake writes its marker, and wait for the run and the fake to end. The run shares
this process, so no child start or kill timer races the cancellation. The signal goes out even without the marker, so
a run that never reaches the pause still stops.
*/
async function cancelAtPause(
    run: Promise<ProcessOutput>,
    marker: string,
    signal: 'SIGINT' | 'SIGTERM',
): Promise<{ result: ProcessOutput; started: Required<PausedGit> }> {
    const isPaused = await waitForFile(marker);
    process.emit(signal);
    const result = await run;
    expect(isPaused, result.stdout + result.stderr).toBe(true);
    const started = JSON.parse(await readFile(marker, 'utf8')) as Required<PausedGit>;
    await waitForExit(started.pid);
    return { result, started };
}

async function fakePausingGit(
    folder: string,
    options: { operation: 'init' | 'checkout-index'; marker: string; pauseOnCall: number },
): Promise<Record<string, string>> {
    const executable = Bun.which('git');
    if (executable === null) throw new Error('The pausing Git fake requires Git on PATH.');
    await writeProgramCommand(
        folder,
        'git',
        'fakes/git',
        '--git',
        executable,
        '--operation',
        options.operation,
        '--pause-on-call',
        String(options.pauseOnCall),
        '--counter',
        join(folder, 'calls.txt'),
        '--marker',
        options.marker,
        '--',
    );
    return { PATH: `${folder}${delimiter}${buildSpawnEnvironment()['PATH'] ?? ''}` };
}

test.skipIf(isWindows).each([...SIGNAL_EXITS])(
    'canceling check --staged during git $operation exits with the signal code, keeps the index and the working file, and a second run passes',
    async ({ operation, signal, exitCode }) => {
        await using sandbox = await testdir();
        await using binaries = await testdir();
        const root = sandbox.path;
        const { indexed, scratch } = await prepareStagedCancellation(root);
        const marker = join(root, 'started.json');
        const git = await fakePausingGit(binaries.path, { operation, marker, pauseOnCall: 1 });
        const run = runGspot(root, ['check', '--staged', '--only', 'project/bash-syntax', '--json'], {
            ...git,
            TMPDIR: scratch,
        });
        const { result } = await cancelAtPause(run, marker, signal);
        expect(result.code, result.stderr).toBe(exitCode);
        expect(JSON.parse(result.stdout)).toMatchObject({ error: 'canceled' });
        expect(await readdir(scratch)).toStrictEqual([]);
        expect(runGitStep(root, ['ls-files', '--stage', '-z'])).toBe(indexed);
        expect(await readFile(join(root, 'source.sh'), 'utf8')).toBe(AUTHORED_SCRIPT);
        const retry = parseCheckReport(
            await runGspot(root, ['check', '--staged', '--only', 'project/bash-syntax', '--json']),
        );
        expect(retry.code, retry.stdout + retry.stderr).toBe(0);
        expect(retry.report.checks[0]!.status).toBe('passed');
    },
);

test.skipIf(isWindows)(
    'canceling a pre-push check keeps the finished reports and names the refs it did not check',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_PUSH_CHECK }),
            'source.sh': 'echo first\n',
        });

        commitAll(sandbox.path);
        const first = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
        await writeFile(join(sandbox.path, 'source.sh'), 'echo second\n');
        runGitStep(sandbox.path, ['commit', '-qam', 'feat: second']);
        const second = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
        await writeFile(join(sandbox.path, 'source.sh'), 'echo edited\n');
        const marker = join(sandbox.path, 'started.json');
        await using binaries = await testdir();
        const protocol = `refs/heads/first ${first} refs/heads/first ${'0'.repeat(first.length)}\nrefs/heads/second ${second} refs/heads/second ${'0'.repeat(second.length)}\n`;
        const git = await fakePausingGit(binaries.path, { operation: 'init', marker, pauseOnCall: 2 });
        const run = runGspot(
            sandbox.path,
            ['check', '--hook', 'pre-push', '--only', 'project/bash-syntax', '--json'],
            git,
            { stdin: protocol },
        );
        const { result, started } = await cancelAtPause(run, marker, 'SIGINT');
        expect(result.code, result.stderr).toBe(130);
        const report = pushOutputSchema.parse(JSON.parse(result.stdout));
        expect(report).toMatchObject({
            revisions: [{ hash: first, report: { checks: [{ status: 'passed' }] } }],
            canceled: { pendingRefs: ['refs/heads/second'] },
            exitCode: 130,
        });
        expect(existsSync(started.checkout)).toBe(false);
    },
);

test.skipIf(isWindows)('canceling a pre-push check while its stdin is open exits with the signal code', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_PUSH_CHECK }),
        'source.sh': 'echo indexed\n',
    });
    commitAll(root);
    const started = join(root, 'listening');
    const command = buildProgramCommand(
        'processes/cli',
        SIGNAL_MARKER_OPTION,
        started,
        'check',
        '--hook',
        'pre-push',
        '--json',
    );
    const limited = limitCommand(command, {
        cwd: root,
        timeoutSeconds: CHILD_TIMEOUT_SECONDS,
    });
    const child = Bun.spawn(command, {
        cwd: root,
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: Math.ceil(limited.options.timeoutSeconds * MILLISECONDS_PER_SECOND),
    });
    await using capture = captureChild(child);
    try {
        await child.stdin.write('refs/heads/incomplete ');
        await child.stdin.flush();
        expect(await waitForFile(started)).toBe(true);
        child.kill('SIGINT');
        expect(await child.exited, await capture.stderr).toBe(130);
        expect(JSON.parse(await capture.stdout)).toMatchObject({ error: 'canceled' });
    } finally {
        await child.stdin.end();
    }
});
