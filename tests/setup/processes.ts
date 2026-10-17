// Starts test commands and limits them to the current test timeout.
import executables from 'which';
import { spyOn, type Mock } from 'bun:test';
import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import { spawnProcess, streamProcess, spawnProcessBlocking } from '#cli/system/processes.ts';
import type { CapturedChild, ProcessBackend, CapturedProcess } from '#tests/types/processes.ts';

import {
    EXIT_POLL_MILLISECONDS,
    MILLISECONDS_PER_SECOND,
    READY_POLL_MILLISECONDS,
    TEST_TIMEOUT_MILLISECONDS,
} from '#tests/data/test-setup.ts';

// Bun runs each file's tests serially; the preload opens and disposes one timeout for each test.
let timeoutAt: number | undefined;

/**
 * Limit a child command to the time the test has left, and build the text a timeout error shows.
 * @param command the child executable and arguments.
 * @param options how to run it, including its own time limit.
 * @returns the limited options and text that names the command.
 */
function prepareCommand(
    command: readonly string[],
    options: AsyncSpawnOptions,
): { options: AsyncSpawnOptions & { timeoutSeconds: number }; context: string } {
    const remaining = computeTimeLeft();
    const context = `Command: ${command.join(' ')}\nWorking directory: ${options.cwd}`;
    if (remaining <= 0)
        throw new Error(`The test timeout has elapsed.\n${context}\nOutput: the command was not started.`);
    const timeoutSeconds =
        Math.min(
            (options.timeoutSeconds ?? TEST_TIMEOUT_MILLISECONDS / MILLISECONDS_PER_SECOND) * MILLISECONDS_PER_SECOND,
            remaining,
        ) / MILLISECONDS_PER_SECOND;
    return { options: { ...options, timeoutSeconds }, context };
}

/**
 * Open one test's timeout.
 * @returns a disposable that restores the previous timeout.
 */
function startTestTimeout(): Disposable {
    const previous = timeoutAt;
    timeoutAt = performance.now() + TEST_TIMEOUT_MILLISECONDS;
    return {
        [Symbol.dispose]() {
            timeoutAt = previous;
        },
    };
}

/** Return the time left for a test or the shared limit outside a test. */
function computeTimeLeft(): number {
    return timeoutAt === undefined ? TEST_TIMEOUT_MILLISECONDS : Math.ceil(timeoutAt - performance.now());
}

function buildTimeoutError(
    timeoutMilliseconds: number,
    context: string,
    result: Pick<SpawnResult, 'stdout' | 'stderr'>,
): Error {
    return new Error(
        `The test command timed out after ${String(timeoutMilliseconds)} ms.\n${context}\n${result.stdout}${result.stderr}`,
    );
}

/**
 * Run a command within its requested limit and the remaining test timeout.
 * @param command the executable and its arguments.
 * @param options the subprocess environment and working directory.
 * @returns the captured subprocess result.
 */
async function runCommand(command: readonly string[], options: AsyncSpawnOptions): Promise<SpawnResult> {
    const prepared = prepareCommand(command, options);
    const result = await spawnProcess(command, prepared.options);
    if (result.isTimedOut === true)
        throw buildTimeoutError(prepared.options.timeoutSeconds * MILLISECONDS_PER_SECOND, prepared.context, result);
    return result;
}

/**
 * Run a synchronous command within the remaining test timeout.
 * @param command the executable and its arguments.
 * @param options the working directory and environment.
 * @returns captured output and process status.
 */
function runCommandBlocking(command: readonly string[], options: AsyncSpawnOptions): SpawnResult {
    const prepared = prepareCommand(command, options);
    const result = spawnProcessBlocking(command, prepared.options);
    if (result.isTimedOut === true)
        throw buildTimeoutError(prepared.options.timeoutSeconds * MILLISECONDS_PER_SECOND, prepared.context, result);
    return result;
}

/**
 * Wait within the remaining test time, then kill a child that remains alive.
 * @param pid child that the test started.
 */
async function waitForExit(pid: number): Promise<void> {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`Invalid child PID: ${String(pid)}.`);
    const deadline = performance.now() + computeTimeLeft();
    while (performance.now() < deadline) {
        try {
            process.kill(pid, 0);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH') return;
            throw error;
        }
        await Bun.sleep(EXIT_POLL_MILLISECONDS);
    }
    process.kill(pid, 'SIGKILL');
    throw new Error(`Owned child ${String(pid)} remained alive after supervision ended.`);
}

/** Wait until a child writes its ready file, or the test runs out of time. */
async function waitForFile(path: string): Promise<boolean> {
    const deadline = performance.now() + computeTimeLeft();
    while (!(await Bun.file(path).exists()) && performance.now() < deadline) await Bun.sleep(READY_POLL_MILLISECONDS);
    return await Bun.file(path).exists();
}

/** Drains a child's output and guarantees termination when a test leaves its scope. */
function captureChild(child: CapturedProcess): CapturedChild {
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

/** Start and capture one test child within the current test deadline. */
function startCommand(
    command: readonly string[],
    options: AsyncSpawnOptions,
): CapturedChild & { child: CapturedProcess & Pick<Bun.Subprocess, 'pid'> } {
    const prepared = prepareCommand(command, options);
    const child = Bun.spawn([...command], {
        cwd: prepared.options.cwd,
        ...(prepared.options.env === undefined ? {} : { env: prepared.options.env }),
        ...(prepared.options.stdin === undefined ? {} : { stdin: Buffer.from(prepared.options.stdin) }),
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: Math.ceil(prepared.options.timeoutSeconds * MILLISECONDS_PER_SECOND),
        killSignal: 'SIGKILL',
    });
    return { child, ...captureChild(child) };
}
export {
    runCommand,
    waitForExit,
    waitForFile,
    captureChild,
    startCommand,
    prepareCommand,
    startTestTimeout,
    runCommandBlocking,
};

/**
 * Make executable lookup return one path, or the path a function picks for each name.
 * @param path the path, or a function of the name; when the function gives undefined, the real lookup runs.
 * @returns the mock.
 */
export function useExecutable(
    path: string | null | ((name: string) => string | null | undefined),
): Mock<typeof executables.sync> {
    const locate = executables.sync;
    return spyOn(executables, 'sync').mockImplementation(((
        name: string,
        options?: executables.Options,
        // eslint-disable-next-line sonarjs/function-return-type -- which.sync returns one path, all paths, or null.
    ): string | string[] | null => {
        const found = typeof path === 'function' ? path(name) : path;
        if (found === undefined) return locate(name, options);
        if (options?.all === true) return found === null ? [] : [found];
        return found;
    }) as typeof executables.sync);
}

/** Capture a command as text or bytes through the same test process timeout. */
export async function captureProcess(
    capture: 'text' | 'bytes',
    command: string[],
    options: AsyncSpawnOptions,
): Promise<Omit<SpawnResult, 'stdout'> & { stdout: string | Buffer }> {
    if (capture === 'text') return spawnProcess(command, prepareCommand(command, options).options);
    const chunks: Buffer[] = [];
    const result = await streamProcess(command, prepareCommand(command, options).options, async (output) => {
        for await (const chunk of output) chunks.push(chunk);
    });
    return { ...result, stdout: Buffer.concat(chunks) };
}

/** Both process functions, asynchronous and blocking, with the shared test timeout. */
export function buildProcessBackends(): ProcessBackend[] {
    return [
        {
            name: 'asynchronous',
            execute: async (command: string[], options: AsyncSpawnOptions) =>
                await spawnProcess(command, prepareCommand(command, options).options),
        },
        {
            name: 'synchronous',
            execute: (command: string[], options: AsyncSpawnOptions) =>
                spawnProcessBlocking(command, prepareCommand(command, options).options),
        },
    ];
}
