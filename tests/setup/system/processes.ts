import { stat } from 'node:fs/promises';
import { hasErrorCode } from '#cli/system/errors.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import { spawnProcess, spawnProcessBlocking } from '#cli/system/processes.ts';
import type { ChildCapture, ProcessCapture } from '#tests/types/processes.ts';
import { TEST_TIMEOUT_MILLISECONDS } from '#tests/config/setup/environment.ts';
import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import { POLL_INTERVAL_MILLISECONDS } from '#tests/config/setup/system/processes.ts';

/**
Limit a child command and build the text a timeout error shows.

@param command the child executable and arguments.
@param options how to run it, including its own time limit.
@returns the limited options and text that names the command.
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

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function buildTimeoutError(
    limited: ReturnType<typeof limitCommand>,
    result: Pick<SpawnResult, 'stdout' | 'stderr'>,
): Error {
    const timeoutMilliseconds = limited.options.timeoutSeconds * MILLISECONDS_PER_SECOND;
    return new Error(
        `The test command timed out after ${String(timeoutMilliseconds)} ms.\n${limited.context}\n${result.stdout}${result.stderr}`,
    );
}

/**
Run a command within its requested limit and the command timeout.

@param command the executable and its arguments.
@param options the subprocess environment and working directory.
@returns the captured subprocess result.
*/
export async function runCommand(command: readonly string[], options: AsyncSpawnOptions): Promise<SpawnResult> {
    const limited = limitCommand(command, options);
    const result = await spawnProcess(command, limited.options);
    if (result.timedOut) throw buildTimeoutError(limited, result);
    return result;
}

/**
Run a synchronous command within the command timeout.

@param command the executable and its arguments.
@param options the working directory and environment.
@returns captured output and process status.
*/
export function runCommandBlocking(command: readonly string[], options: AsyncSpawnOptions): SpawnResult {
    const limited = limitCommand(command, options);
    const result = spawnProcessBlocking(command, limited.options);
    if (result.timedOut) throw buildTimeoutError(limited, result);
    return result;
}

/**
Wait within the command timeout, then kill a child that remains alive.

@param pid child that the test started.
*/
export async function waitForExit(pid: number): Promise<void> {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`Invalid child PID: ${String(pid)}.`);
    const deadline = performance.now() + TEST_TIMEOUT_MILLISECONDS;
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

@param path the ready file.
@returns whether the file holds bytes.
*/
export async function waitForFile(path: string): Promise<boolean> {
    const deadline = performance.now() + TEST_TIMEOUT_MILLISECONDS;
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
export function startCommand(
    command: readonly string[],
    options: AsyncSpawnOptions,
): ChildCapture & { child: ProcessCapture & Pick<Bun.Subprocess, 'pid'> } {
    const limited = limitCommand(command, options);
    const child = Bun.spawn([...command], {
        cwd: limited.options.cwd,
        ...(limited.options.env !== undefined && { env: limited.options.env }),
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

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 89 calls in 31 files share it.
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
        output,
        errors,
        async [Symbol.asyncDispose]() {
            if (child.exitCode === null) child.kill('SIGKILL');
            await child.exited;
            await output;
            await errors;
        },
    };
}
