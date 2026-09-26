import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

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
    return await runProcess([process.execPath, gspot, ...argv], {
        cwd,
        env: { ...process.env, NO_COLOR: '1', CI: '1', ...environment },
        timeoutMs: PLANTED_TIMEOUT_MS * 2,
    });
}

/** Observes an acceptance command independently of the production process supervisor. */
export async function runProcess(
    argv: string[],
    options: { cwd: string; env?: Record<string, string | undefined>; timeoutMs?: number; stdin?: string },
): Promise<SpawnOutcome> {
    const [executable, ...arguments_] = argv;
    return await new Promise<SpawnOutcome>((resolve, reject) => {
        const child = spawn(executable!, arguments_, {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            detached: process.platform !== 'win32',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
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
        const deadline = setTimeout(
            () => { terminate(`Command exceeded ${String(options.timeoutMs ?? PLANTED_TIMEOUT_MS * 2)} ms`); },
            options.timeoutMs ?? PLANTED_TIMEOUT_MS * 2,
        );
        for (const [name, stream] of [
            ['stdout', child.stdout],
            ['stderr', child.stderr],
        ] as const) {
            stream.setEncoding('utf8');
            stream.on('data', (chunk: string) => {
                bytes += Buffer.byteLength(chunk);
                if (bytes > 32 * 1024 * 1024) {
                    terminate('Command output exceeded 32 MiB');
                    return;
                }
                if (name === 'stdout') stdout += chunk;
                else stderr += chunk;
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
                        `Could not complete ${argv.join(' ')} in ${options.cwd}: ${failure?.message ?? signal}\n${stdout}\n${stderr}`,
                        { cause: failure },
                    ),
                );
                return;
            }
            resolve({ code, stdout, stderr });
        });
        child.stdin.end(options.stdin);
    });
}
