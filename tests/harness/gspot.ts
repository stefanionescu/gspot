// Running gspot from a test: in-process for command behavior, or as a child process end to end.
import { join } from 'node:path';
import { spyOn } from 'bun:test';
import { main } from '#cli/commands/program.ts';
import { CHECKS } from '#cli/checks/registry.ts';
import { workspaceRoot } from '#automation/workspace.ts';
import { SOURCE_CLI_PATH } from '#tests/config/harness/cli.ts';
import type { RunOptions } from '#cli/types/execution/check.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { CapturedProcess } from '#tests/types/harness/process.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { runTestCommand, prepareTestCommand } from '#tests/harness/command.ts';
import type { SpawnOutcome, GspotChildOptions, GspotSpawnOptions } from '#tests/types/harness/command.ts';

/** Resolve the source executable once for this checkout's test processes. */
export const gspot = join(workspaceRoot, SOURCE_CLI_PATH);

/**
 * Runs gspot in this process over a directory with color off and CI set, capturing what it writes.
 * @param cwd the test repository
 * @param argv the command line after gspot
 * @param environment verbatim variables, restored afterwards
 * @returns the exit code and both streams
 */
export async function runGspot(
    cwd: string,
    argv: string[],
    environment: Record<string, string> = {},
): Promise<SpawnOutcome> {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = [
        spyOn(process.stdout, 'write').mockImplementation(
            (chunk: string | Uint8Array) => stdout.push(Buffer.from(chunk).toString()) > 0,
        ),
        spyOn(process.stderr, 'write').mockImplementation(
            (chunk: string | Uint8Array) => stderr.push(Buffer.from(chunk).toString()) > 0,
        ),
    ];
    const variables: Record<string, string> = { NO_COLOR: '1', CI: '1', ...environment };
    const current = environmentVariables();
    const previous = Object.keys(variables).map((name) => [name, current[name]] as const);
    const exitCode = process.exitCode;
    for (const [name, value] of Object.entries(variables)) setEnvironmentVariable(name, value);
    process.exitCode = 0;
    try {
        const code = await main(['-C', cwd, ...argv]);
        return { code, stdout: stdout.join(''), stderr: stderr.join('') };
    } finally {
        for (const spy of writes) spy.mockRestore();
        for (const [name, value] of previous) setEnvironmentVariable(name, value);
        // Bun keeps the last code when undefined is assigned, so an unset code comes back as 0.
        process.exitCode = exitCode ?? 0;
    }
}

/**
 * Runs gspot as a child process in a directory with color off and CI set, through the product's own process runner.
 * @param cwd the test repository
 * @param argv the command line after gspot
 * @param environment verbatim variables
 * @param options stdin and the requested command limit, clamped to the remaining test budget
 * @returns the exit code and both streams
 */

export async function spawnGspot(
    cwd: string,
    argv: string[],
    environment: Record<string, string> = {},
    options: GspotSpawnOptions = {},
): Promise<SpawnOutcome> {
    return await runTestCommand([process.execPath, gspot, ...argv], {
        cwd,
        env: { NO_COLOR: '1', CI: '1', ...environment },
        timeoutMs: NATIVE_TEST_TIMEOUT_MS,
        ...options,
    });
}

/**
 * Start a source CLI subprocess for signals or exact byte input.
 * @param cwd the test repository
 * @param argv the command line after gspot
 * @param environment verbatim variables
 * @param options stdin and the requested command limit
 * @returns the live child; captureChild owns its output and cleanup
 */
export function startGspot(
    cwd: string,
    argv: string[],
    environment: Record<string, string> = {},
    options: GspotChildOptions = {},
): CapturedProcess {
    const command = [process.execPath, gspot, ...argv];
    const { stdin, ...limits } = options;
    const prepared = prepareTestCommand(command, { cwd, ...limits }, 'source CLI subprocess');
    return Bun.spawn(command, {
        cwd,
        env: { ...environmentVariables(), NO_COLOR: '1', CI: '1', ...environment },
        stdin: typeof stdin === 'string' ? Buffer.from(stdin) : (stdin ?? 'ignore'),
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: prepared.options.timeoutMs,
        killSignal: 'SIGKILL',
    });
}

/**
 * The options of an in-process run: every stage, the built-in checks, nothing skipped, no fixes, and a real run.
 * @param overrides the options a test changes, such as the checks it runs with only
 * @returns the run options
 */

export function buildRunOptions(overrides: Partial<RunOptions> = {}): RunOptions {
    return { checks: CHECKS, stage: 'all', skips: [], fix: false, isDryRun: false, ...overrides };
}
