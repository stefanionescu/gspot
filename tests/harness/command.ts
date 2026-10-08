// Bound child processes by their test's remaining time and retain evidence when a step times out.
import { spyOn, type Mock } from 'bun:test';
import * as processes from '#cli/platform/public.ts';
import { run, runBlocking } from '#cli/platform/public.ts';
import { TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { TestStep } from '#tests/types/harness/command.ts';
import { STEP_ARGUMENTS } from '#tests/config/harness/command.ts';
import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/platform/runtime.ts';

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
    const remaining = remainingTestTime();
    const context = `Command: ${command.join(' ')}\nWorking directory: ${options.cwd}\nStep: ${step}`;
    if (remaining <= 0)
        throw new Error(`The test budget is exhausted.\n${context}\nOutput: the command was not started.`);
    const timeoutMs = Math.min(options.timeoutMs ?? TEST_TIMEOUT_MS, remaining);
    return { options: { ...options, timeoutMs }, context };
}

/**
 * Open one test's deadline.
 * @returns ownership that restores the prior deadline.
 */
export function openTestBudget(): Disposable {
    const previous = deadline;
    deadline = performance.now() + TEST_TIMEOUT_MS;
    return {
        [Symbol.dispose]() {
            deadline = previous;
        },
    };
}

/** Return the time left for a test or the shared limit outside a test. */
export function remainingTestTime(): number {
    return deadline === undefined ? TEST_TIMEOUT_MS : Math.ceil(deadline - performance.now());
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

/**
 * Replace one outbound command while retaining native execution for the others.
 * @param name the executable to replace.
 * @param result the replacement command result calculation.
 * @returns a spy whose disposal restores native execution.
 */
export function fakeCommand(name: string, result: typeof run): Mock<typeof run> {
    const nativeRun = processes.run;
    return spyOn(processes, 'run').mockImplementation((command, options) =>
        command[0] === name ? result(command, options) : nativeRun(command, options),
    );
}
