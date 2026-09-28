import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import type { SpawnOutcome } from '#tests/types/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/cli.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

/** The development entry point, run with bun. */
export const gspot = join(root, 'packages', 'cli', 'src', 'main.ts');

/**
 * Runs gspot in a directory with color off and CI set.
 * @param cwd the planted repository
 * @param argv the command line after gspot
 * @param environment extra variables
 * @returns the exit code and both streams
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Runs gspot in a directory with color off and CI set. 143 files make 779 calls; one owner keeps that behavior in one place.
export async function run(
    cwd: string,
    argv: string[],
    environment: Record<string, string> = {},
): Promise<SpawnOutcome> {
    return await runProcess([process.execPath, gspot, ...argv], {
        cwd,
        env: { ...environmentVariables(), NO_COLOR: '1', CI: '1', ...environment },
        timeoutMs: PLANTED_TIMEOUT_MS * 2,
    });
}

/** Observes an acceptance command independently of the production process supervisor. */
export async function runProcess(
    argv: string[],
    options: { cwd: string; env?: Record<string, string | undefined>; timeoutMs?: number; stdin?: string },
): Promise<SpawnOutcome> {
    const [executable, ...commandArguments] = argv;
    return await new Promise<SpawnOutcome>((complete, reject) => {
        const child = spawn(executable!, commandArguments, {
            cwd: options.cwd,
            env: { ...environmentVariables(), ...options.env },
            detached: process.platform !== 'win32',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const output = { stdout: '', stderr: '' };
        let bytes = 0;
        let failure: Error | undefined;
        const terminate = (reason: string): void => {
            failure = new Error(reason);
            try {
                if (process.platform !== 'win32' && child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
                else child.kill('SIGKILL');
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ESRCH') failure = error as Error;
            }
        };
        const timeoutMs = options.timeoutMs ?? PLANTED_TIMEOUT_MS * 2;
        const deadline = setTimeout(() => {
            terminate(`Command exceeded ${String(timeoutMs)} ms`);
        }, timeoutMs);
        for (const [name, stream] of [
            ['stdout', child.stdout],
            ['stderr', child.stderr],
        ] as const) {
            stream.setEncoding('utf8').on('data', (chunk: string) => {
                bytes += Buffer.byteLength(chunk);
                if (bytes > 32 * 1024 * 1024) {
                    terminate('Command output exceeded 32 MiB');
                    return;
                }
                output[name] += chunk;
            });
        }
        child.once('error', (error) => {
            failure = error;
        });
        child.once('close', (code, signal) => {
            clearTimeout(deadline);
            if (failure !== undefined || code === null) {
                reject(
                    new Error(
                        `Could not complete ${argv.join(' ')} in ${options.cwd}: ${failure?.message ?? signal ?? 'no signal'}\n${output.stdout}\n${output.stderr}`,
                        { cause: failure },
                    ),
                );
                return;
            }
            complete({ code, ...output });
        });
        child.stdin.end(options.stdin);
    });
}
