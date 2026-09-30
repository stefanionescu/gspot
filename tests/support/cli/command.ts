import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as spawn } from '#cli/platform/spawn.ts';
import type { SpawnOutcome } from '#tests/types/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

/** The development entry point, run with bun. */
export const gspot = join(root, 'packages', 'cli', 'src', 'main.ts');

/**
 * Runs gspot in a directory with color off and CI set, through the product's own process runner.
 * @param cwd the planted repository
 * @param argv the command line after gspot
 * @param environment extra variables
 * @param timeoutMs how long the command may run. A push stage on a slow runner passes the planted default.
 * @returns the exit code and both streams
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every CLI test runs gspot with color off and CI set through this.
export async function run(
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
