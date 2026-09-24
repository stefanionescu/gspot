import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as runProcess } from '#cli/platform/spawn.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

/** What a spawned command left behind, for tests. */
export type SpawnOutcome = { code: number; stdout: string; stderr: string };

/** How long a planted-repository test may take: it spawns real tools. */
export const PLANTED_TIMEOUT_MS = 60_000;

/** The development entry point, run with bun. */
export const gspot = join(root, 'packages', 'cli', 'src', 'main.ts');

/**
 * Runs gspot in a directory with color off and CI set.
 * @param cwd the planted repository
 * @param argv the command line after gspot
 * @param environment extra variables
 * @returns the exit code and both streams
 */
export async function run(
    cwd: string,
    argv: string[],
    environment: Record<string, string> = {},
): Promise<SpawnOutcome> {
    const result = await runProcess([process.execPath, gspot, ...argv], {
        cwd,
        env: { NO_COLOR: '1', CI: '1', ...environment },
        timeoutMs: PLANTED_TIMEOUT_MS * 2,
    });
    if (result.isTimedOut === true)
        throw new Error(
            `Command gspot ${argv.join(' ')} timed out in ${cwd}.\n` +
                `Duration: ${result.duration.toFixed(0)} ms; exit: ${String(result.code)}.\n` +
                `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
        );
    if (result.missing) throw new Error(`Could not launch gspot: ${result.stderr}`);
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
}
