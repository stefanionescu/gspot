import { stat } from 'node:fs/promises';
import { hasErrorCode } from '#cli/system/errors.ts';
import type { ChildProcess } from 'node:child_process';
import { isWindows } from '#tests/setup/system/platform.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { spawnProcess, spawnProcessBlocking } from '#cli/system/processes.ts';
import { type ChildCapture, type ProcessCapture } from '#tests/types/processes.ts';
import { POLL_INTERVAL_MILLISECONDS } from '#tests/config/setup/system/processes.ts';
import { type SpawnResult, type AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import { TEST_TIMEOUT_MILLISECONDS, UNIT_TEST_TIMEOUT_MILLISECONDS } from '#tests/config/setup/runner.ts';

/**
Limit a child command and build the text a timeout error shows.
*/
export function limitCommand(
    command: readonly string[],
    options: AsyncSpawnOptions,
): { options: AsyncSpawnOptions & { timeoutSeconds: number }; context: string } {
    const context = `Command: ${command.join(' ')}\nWorking directory: ${options.cwd}`;
    const timeoutSeconds = Math.min(
        options.timeoutSeconds ?? Infinity,
        TEST_TIMEOUT_MILLISECONDS / MILLISECONDS_PER_SECOND,
    );
    return { options: { ...options, timeoutSeconds }, context };
}

/**
Run a command within its requested limit and the command timeout.
*/
export async function runCommand(command: readonly string[], options: AsyncSpawnOptions): Promise<SpawnResult> {
    const limited = limitCommand(command, options);
    const result = await spawnProcess(command, limited.options);
    return readCommandResult(result, limited);
}

/**
Run a synchronous command within the command timeout.
*/
export function runCommandBlocking(command: readonly string[], options: AsyncSpawnOptions): SpawnResult {
    const limited = limitCommand(command, options);
    const result = spawnProcessBlocking(command, limited.options);
    return readCommandResult(result, limited);
}

function readCommandResult(result: SpawnResult, limited: ReturnType<typeof limitCommand>): SpawnResult {
    if (!result.timedOut) return result;
    const message = `The test command timed out after ${String(limited.options.timeoutSeconds * MILLISECONDS_PER_SECOND)} ms.\n${limited.context}\n${result.stdout}${result.stderr}`;
    throw new Error(message);
}

/**
Wait within the command timeout, then kill a child that remains alive.
*/
export async function waitForExit(pid: number): Promise<void> {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`Invalid child PID: ${String(pid)}.`);
    const deadline = performance.now() + UNIT_TEST_TIMEOUT_MILLISECONDS - MILLISECONDS_PER_SECOND;
    while (performance.now() < deadline) {
        try {
            process.kill(pid, 0);
        } catch (error) {
            if (hasErrorCode(error, 'ESRCH')) return;
            throw error;
        }
        await Bun.sleep(POLL_INTERVAL_MILLISECONDS);
    }
    process.kill(pid, 'SIGKILL');
    throw new Error(`Owned child ${String(pid)} remained alive after supervision ended.`);
}

/**
Wait until a child writes its ready file, or the command timeout elapses. A child creates the file before it writes the
content, so the file counts as ready once it holds bytes.
*/
export async function waitForFile(path: string): Promise<boolean> {
    const deadline = performance.now() + UNIT_TEST_TIMEOUT_MILLISECONDS - MILLISECONDS_PER_SECOND;
    while (performance.now() < deadline) {
        try {
            const file = await stat(path);
            if (file.size > 0) return true;
        } catch (error) {
            if (!hasErrorCode(error, 'ENOENT')) throw error;
        }
        await Bun.sleep(POLL_INTERVAL_MILLISECONDS);
    }
    return false;
}

/**
Start and capture one test child within the command timeout.
*/
export function spawnCommand(
    command: readonly string[],
    options: AsyncSpawnOptions,
): ChildCapture & { child: ProcessCapture & Pick<Bun.Subprocess, 'pid'> } {
    const limited = limitCommand(command, options);
    const child = Bun.spawn([...command], {
        cwd: limited.options.cwd,
        env: buildSpawnEnvironment(limited.options.env),
        ...(limited.options.stdin !== undefined && { stdin: Buffer.from(limited.options.stdin) }),
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: Math.ceil(limited.options.timeoutSeconds * MILLISECONDS_PER_SECOND),
        killSignal: 'SIGKILL',
    });
    return { child, ...captureChild(child) };
}

/**
A process result for check tests, with these fields changed.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Process tests share the successful exit fields and override only the fields under test.
export function buildProcessResult(overrides: Partial<SpawnResult> = {}): SpawnResult {
    return {
        timedOut: false,
        canceled: false,
        errored: false,
        code: 0,
        stdout: '',
        stderr: '',
        missing: false,
        duration: 1,
        ...overrides,
    };
}

/**
Drain the output of a child process, and end it when a test leaves its scope.
*/
export function captureChild(child: ProcessCapture): ChildCapture {
    const output = new Response(child.stdout).text();
    const errors = new Response(child.stderr).text();
    return {
        stdout: output,
        stderr: errors,
        async [Symbol.asyncDispose]() {
            if (child.exitCode === null) child.kill('SIGKILL');
            await child.exited;
            await output;
            await errors;
        },
    };
}

export const CHILD_TIMEOUT_SECONDS =
    (UNIT_TEST_TIMEOUT_MILLISECONDS - MILLISECONDS_PER_SECOND) / MILLISECONDS_PER_SECOND;

/**
Check whether a child stopped: Windows sets its exit code, and other systems set the signal that ended it.
*/
export function isStopped(child: ChildProcess | undefined): boolean {
    if (child === undefined) return false;
    return (isWindows ? child.exitCode : child.signalCode) !== null;
}
