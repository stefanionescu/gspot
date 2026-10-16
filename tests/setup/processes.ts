// Starts test commands and limits them to the current test timeout.
import { spyOn, type Mock } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { spawnProcess, spawnProcessBlocking } from '#cli/system/processes.ts';
import type { CapturedChild, CapturedProcess } from '#tests/types/processes.ts';
import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import { EXIT_POLL_MS, READY_POLL_MS, MS_PER_SECOND, TEST_TIMEOUT_MS } from '#tests/config/processes.ts';

// Bun runs each file's tests serially; the preload opens and disposes one timeout for each test.
let timeoutAt: number | undefined;

/**
 * Clamp a child command to the test's remaining timeout and retain its timeout context.
 * @param command the child executable and arguments.
 * @param options the requested working directory, environment, and time limit.
 * @returns bounded options and diagnostic context for a child process.
 */
function prepareCommand(
    command: readonly string[],
    options: AsyncSpawnOptions,
): { options: AsyncSpawnOptions & { timeoutSeconds: number }; context: string } {
    const remaining = timeLeft();
    const context = `Command: ${command.join(' ')}\nWorking directory: ${options.cwd}`;
    if (remaining <= 0)
        throw new Error(`The test timeout has elapsed.\n${context}\nOutput: the command was not started.`);
    const timeoutSeconds =
        Math.min((options.timeoutSeconds ?? TEST_TIMEOUT_MS / MS_PER_SECOND) * MS_PER_SECOND, remaining) /
        MS_PER_SECOND;
    return { options: { ...options, timeoutSeconds }, context };
}

/**
 * Open one test's timeout.
 * @returns a disposable that restores the previous timeout.
 */
function startTestTimeout(): Disposable {
    const previous = timeoutAt;
    timeoutAt = performance.now() + TEST_TIMEOUT_MS;
    return {
        [Symbol.dispose]() {
            timeoutAt = previous;
        },
    };
}

/** Return the time left for a test or the shared limit outside a test. */
function timeLeft(): number {
    return timeoutAt === undefined ? TEST_TIMEOUT_MS : Math.ceil(timeoutAt - performance.now());
}

function commandTimeoutError(
    timeoutMs: number,
    context: string,
    result: Pick<SpawnResult, 'stdout' | 'stderr'>,
): Error {
    return new Error(
        `The test command timed out after ${String(timeoutMs)} ms.\n${context}\n${result.stdout}${result.stderr}`,
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
    const result = await spawnProcess([...command], prepared.options);
    if (result.isTimedOut === true)
        throw commandTimeoutError(prepared.options.timeoutSeconds * MS_PER_SECOND, prepared.context, result);
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
    const result = spawnProcessBlocking([...command], prepared.options);
    if (result.isTimedOut === true)
        throw commandTimeoutError(prepared.options.timeoutSeconds * MS_PER_SECOND, prepared.context, result);
    return result;
}

/**
 * Replace one child command and run the others normally.
 * @param name the executable to replace.
 * @param result the replacement command result calculation.
 * @returns a spy whose disposal restores command execution.
 */
function fakeCommand(name: string, result: typeof spawnProcess): Mock<typeof spawnProcess> {
    const runProcess = processes.spawnProcess;
    return spyOn(processes, 'spawnProcess').mockImplementation((command, options) =>
        command[0] === name ? result(command, options) : runProcess(command, options),
    );
}

/**
 * Wait within the remaining test time, then kill a child that remains alive.
 * @param pid the owned child process ID.
 */
async function waitForExit(pid: number): Promise<void> {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`Invalid child PID: ${String(pid)}.`);
    const deadline = performance.now() + timeLeft();
    while (performance.now() < deadline) {
        try {
            process.kill(pid, 0);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH') return;
            throw error;
        }
        await Bun.sleep(EXIT_POLL_MS);
    }
    process.kill(pid, 'SIGKILL');
    throw new Error(`Owned child ${String(pid)} remained alive after supervision ended.`);
}

/** Polls a child-written readiness marker until its bounded startup deadline. */
async function waitForFile(path: string): Promise<boolean> {
    const deadline = performance.now() + timeLeft();
    while (!(await Bun.file(path).exists()) && performance.now() < deadline) await Bun.sleep(READY_POLL_MS);
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
): CapturedChild & { child: CapturedProcess } {
    const prepared = prepareCommand(command, options);
    const child = Bun.spawn([...command], {
        cwd: prepared.options.cwd,
        ...(prepared.options.env === undefined ? {} : { env: prepared.options.env }),
        ...(prepared.options.stdin === undefined ? {} : { stdin: Buffer.from(prepared.options.stdin) }),
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: prepared.options.timeoutSeconds * MS_PER_SECOND,
        killSignal: 'SIGKILL',
    });
    return { child, ...captureChild(child) };
}

/** Construct the external process result used by check tests. */
function processResult(overrides: Partial<SpawnResult> = {}): SpawnResult {
    return { code: 0, stdout: '', stderr: '', missing: false, duration: 1, ...overrides };
}

export {
    runCommand,
    fakeCommand,
    waitForExit,
    waitForFile,
    captureChild,
    startCommand,
    processResult,
    prepareCommand,
    startTestTimeout,
    runCommandBlocking,
};
