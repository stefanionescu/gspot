// Bound child processes by their test's remaining time and retain evidence when a step times out.
import { run, runBlocking } from '#cli/platform/spawn.ts';
import type { TestStep } from '#tests/types/harness/command.ts';
import { TEST_TIMEOUT_MS, NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/platform/runtime.ts';
import { STEP_ARGUMENTS, SLOW_SUITE_PATH, TEST_CLEANUP_MS } from '#tests/config/harness/command.ts';

// Bun runs these suites serially; the preload opens and disposes one budget around each test.
let deadline: number | undefined;

/**
 * Clamp a child command to the scenario's remaining budget and retain its timeout context.
 * @param command the child executable and arguments.
 * @param options the requested working directory, environment, and time limit.
 * @param step the scenario step named by a timeout.
 * @returns bounded options and diagnostic context for an owned runner or signaled child.
 */
export function prepareTestCommand(command: string[], options: AsyncSpawnOptions, step: string): TestStep {
    const remaining =
        deadline === undefined ? (options.timeoutMs ?? suiteTimeout()) : Math.ceil(deadline - performance.now());
    const context = `Command: ${command.join(' ')}\nWorking directory: ${options.cwd}\nStep: ${step}`;
    if (remaining <= 0)
        throw new Error(`The test budget is exhausted.\n${context}\nOutput: the command was not started.`);
    const timeoutMs = Math.min(options.timeoutMs ?? suiteTimeout(), remaining);
    return { options: { ...options, timeoutMs }, context };
}

/**
 * Open one test's deadline, reserving time to dispose its resources.
 * @param duration the suite's complete test limit.
 * @returns ownership that restores the prior deadline.
 */
export function openTestBudget(duration: number): Disposable {
    const previous = deadline;
    deadline = performance.now() + duration - TEST_CLEANUP_MS;
    return {
        [Symbol.dispose]() {
            deadline = previous;
        },
    };
}

/**
 * Determine the limit of the suite selected by the Bun command.
 * @returns one minute for CLI and plugin, fifteen minutes for native suites.
 */

export function suiteTimeout(): number {
    return SLOW_SUITE_PATH.test(Bun.argv[1] ?? '') ? NATIVE_TEST_TIMEOUT_MS : TEST_TIMEOUT_MS;
}

/**
 * Run a test step within both its requested limit and the remaining test budget.
 * @param command the executable and its arguments.
 * @param options the subprocess environment and working directory.
 * @param step the scenario step reported if execution times out.
 * @returns the captured subprocess result.
 */
export async function runTestCommand(
    command: string[],
    options: AsyncSpawnOptions,
    step: string = command.slice(0, STEP_ARGUMENTS).join(' '),
): Promise<SpawnResult> {
    const prepared = prepareTestCommand(command, options, step);
    const result = await run(command, prepared.options);
    if (result.isTimedOut === true)
        throw new Error(
            `The test step timed out after ${String(prepared.options.timeoutMs)} ms.\n${prepared.context}\n${result.stdout}${result.stderr}`,
        );
    return result;
}

/**
 * Run synchronous Git and inspection steps within the remaining scenario time.
 * @param command the executable and its arguments.
 * @param options the working directory and environment.
 * @param step the scenario step reported if execution times out.
 * @returns captured output and process status.
 */
export function runTestCommandBlocking(
    command: string[],
    options: AsyncSpawnOptions,
    step: string = command.slice(0, STEP_ARGUMENTS).join(' '),
): SpawnResult {
    const prepared = prepareTestCommand(command, options, step);
    const result = runBlocking(command, prepared.options);
    if (result.isTimedOut === true)
        throw new Error(
            `The test step timed out after ${String(prepared.options.timeoutMs)} ms.\n${prepared.context}\n${result.stdout}${result.stderr}`,
        );
    return result;
}
