import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Readable, Writable } from 'node:stream';
import type { SpawnOutcome } from '#tests/types/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { spawn, type ChildProcessByStdio } from 'node:child_process';

const root = fileURLToPath(new URL('../../..', import.meta.url));

// One argument as cmd.exe reads it: quoted, with inner quotes escaped and every shell metacharacter caret-escaped.
function quotedForCmd(argument: string): string {
    let quoted = '"';
    let backslashes = 0;
    for (const character of argument) {
        if (character === '\\') {
            backslashes += 1;
            continue;
        }
        quoted += '\\'.repeat(character === '"' ? backslashes * 2 + 1 : backslashes) + character;
        backslashes = 0;
    }
    quoted += '\\'.repeat(backslashes * 2) + '"';
    return quoted.replaceAll(/[()%!^"<>&|]/gu, '^$&');
}

// Node refuses a Windows command file without a shell, so one runs through cmd.exe with every argument quoted.
function spawnChild(
    executable: string,
    commandArguments: string[],
    options: { cwd: string; env?: Record<string, string | undefined> },
): ChildProcessByStdio<Writable, Readable, Readable> {
    const env = { ...environmentVariables(), ...options.env };
    if (process.platform === 'win32' && /\.(?:cmd|bat)$/iu.test(executable)) {
        const line = [executable, ...commandArguments].map((argument) => quotedForCmd(argument)).join(' ');
        return spawn(
            environmentVariables()['ComSpec'] ?? String.raw`C:\Windows\System32\cmd.exe`,
            ['/d', '/s', '/c', `"${line}"`],
            {
                cwd: options.cwd,
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsVerbatimArguments: true,
            },
        );
    }
    return spawn(executable, commandArguments, {
        cwd: options.cwd,
        env,
        detached: process.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
    });
}

/** The development entry point, run with bun. */
export const gspot = join(root, 'packages', 'cli', 'src', 'main.ts');

/**
 * Runs gspot in a directory with color off and CI set.
 * @param cwd the planted repository
 * @param argv the command line after gspot
 * @param environment extra variables
 * @param timeoutMs how long the command may run. A push stage on a slow runner passes the planted default.
 * @returns the exit code and both streams
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Runs gspot in a directory with color off and CI set. 143 files make 779 calls; one owner keeps that behavior in one place.
export async function run(
    cwd: string,
    argv: string[],
    environment: Record<string, string> = {},
    timeoutMs: number = PLANTED_TIMEOUT_MS * 2,
): Promise<SpawnOutcome> {
    return await runProcess([process.execPath, gspot, ...argv], {
        cwd,
        env: { ...environmentVariables(), NO_COLOR: '1', CI: '1', ...environment },
        timeoutMs,
    });
}

/** Observes an acceptance command independently of the production process supervisor. */
export async function runProcess(
    argv: string[],
    options: { cwd: string; env?: Record<string, string | undefined>; timeoutMs?: number; stdin?: string },
): Promise<SpawnOutcome> {
    const [executable, ...commandArguments] = argv;
    return await new Promise<SpawnOutcome>((complete, reject) => {
        const child = spawnChild(executable!, commandArguments, options);
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
