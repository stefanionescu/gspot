// Running gspot from a test: in-process for the integration tier, or as a child process end to end.
import { join } from 'node:path';
import { spyOn } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { main } from '#cli/commands/program.ts';
import { CHECKS } from '#cli/checks/registry.ts';
import { run as spawn } from '#cli/platform/spawn.ts';
import type { SpawnOutcome } from '#tests/types/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunOptions } from '#cli/types/execution/execution.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

/** The development entry point, run with bun. */
export const gspot = join(root, 'packages', 'cli', 'src', 'main.ts');

/**
 * Runs gspot in this process over a directory with color off and CI set, capturing what it writes.
 * @param cwd the planted repository
 * @param argv the command line after gspot
 * @param environment extra variables, restored afterwards
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
 * @param cwd the planted repository
 * @param argv the command line after gspot
 * @param environment extra variables
 * @param timeoutMs how long the command may run. A push stage on a slow runner passes the planted default.
 * @returns the exit code and both streams
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every end-to-end test runs gspot with color off and CI set through this.
export async function spawnGspot(
    cwd: string,
    argv: string[],
    environment: Record<string, string> = {},
    timeoutMs: number = PLANTED_TIMEOUT_MS * 2,
): Promise<SpawnOutcome> {
    return await spawn([process.execPath, gspot, ...argv], {
        cwd,
        env: { ...environmentVariables(), NO_COLOR: '1', CI: '1', ...environment },
        timeoutMs,
    });
}

/**
 * The options of an in-process run: every stage, the built-in checks, nothing skipped, no fixes, and a real run.
 * @param overrides the options a test changes, such as the checks it runs with only
 * @returns the run options
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Most run tests change one or two options of the same defaults.
export function runOptions(overrides: Partial<RunOptions> = {}): RunOptions {
    return { checks: CHECKS, stage: 'all', skips: [], fix: false, isDryRun: false, ...overrides };
}
