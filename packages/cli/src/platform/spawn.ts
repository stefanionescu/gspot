// Spawning without a shell: Bun.spawn, and cross-spawn for the .cmd shims npm writes on Windows.
import crossSpawn from 'cross-spawn';
import type { SpawnResult, SpawnOptions } from '#types/platform.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

const MISSING_CODE = 127;
const FAILED_CODE = 1;
const isWindows = process.platform === 'win32';

function environment(extra?: Record<string, string>): Record<string, string> {
    return { ...environmentVariables(), ...extra };
}

function failed(error: unknown, started: number): SpawnResult {
    const { code, message: text } = error as NodeJS.ErrnoException;
    return {
        code: MISSING_CODE,
        stdout: '',
        stderr: text,
        missing: code === 'ENOENT',
        duration: performance.now() - started,
    };
}

function runOnWindows(
    executable: string,
    argv: string[],
    options: SpawnOptions,
    started: number,
): Promise<SpawnResult> {
    return new Promise((settle) => {
        const child = crossSpawn(executable, argv, {
            cwd: options.cwd,
            env: environment(options.env),
            stdio: ['pipe', 'pipe', 'pipe'],
            ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
        });
        const out: Buffer[] = [];
        const error: Buffer[] = [];
        child.stdout?.on('data', (chunk: Buffer) => {
            out.push(chunk);
        });
        child.stderr?.on('data', (chunk: Buffer) => {
            error.push(chunk);
        });
        child.on('error', (spawnError: NodeJS.ErrnoException) => {
            settle(failed(spawnError, started));
        });
        child.on('close', (code, signal) => {
            settle({
                isTimedOut: signal !== null && options.timeoutMs !== undefined,
                code: code ?? FAILED_CODE,
                stdout: Buffer.concat(out).toString('utf8'),
                stderr: Buffer.concat(error).toString('utf8'),
                missing: false,
                duration: performance.now() - started,
            });
        });
        if (options.stdin === undefined) child.stdin?.end();
        else child.stdin?.end(options.stdin);
    });
}

async function spawnBun(command: string[], options: SpawnOptions, started: number): Promise<SpawnResult> {
    const proc = Bun.spawn(command, {
        cwd: options.cwd,
        env: environment(options.env),
        stdin: options.stdin === undefined ? 'ignore' : new TextEncoder().encode(options.stdin),
        stdout: 'pipe',
        stderr: 'pipe',
    });
    const state = { isTimedOut: false };
    const timer =
        options.timeoutMs === undefined
            ? undefined
            : setTimeout(() => {
                  state.isTimedOut = true;
                  proc.kill();
              }, options.timeoutMs);
    const [stdout, stderr, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);
    if (timer !== undefined) clearTimeout(timer);
    return {
        code,
        stdout,
        stderr,
        missing: false,
        duration: performance.now() - started,
        isTimedOut: state.isTimedOut,
    };
}

function runBlockingOnWindows(executable: string, argv: string[], options: SpawnOptions, started: number): SpawnResult {
    const result = crossSpawn.sync(executable, argv, {
        cwd: options.cwd,
        env: environment(options.env),
        input: options.stdin,
        encoding: 'utf8',
        ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
    });
    const isMissing = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
    return {
        code: result.status ?? (isMissing ? MISSING_CODE : FAILED_CODE),
        stdout: result.stdout,
        stderr: result.stderr === '' ? (result.error?.message ?? '') : result.stderr,
        missing: isMissing,
        duration: performance.now() - started,
    };
}

function spawnBunBlocking(command: string[], options: SpawnOptions, started: number): SpawnResult {
    const result = Bun.spawnSync(command, {
        cwd: options.cwd,
        env: environment(options.env),
        stdin: options.stdin === undefined ? 'ignore' : new TextEncoder().encode(options.stdin),
        stdout: 'pipe',
        stderr: 'pipe',
        ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
    });
    return {
        isTimedOut: result.exitedDueToTimeout === true,
        code: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
        missing: false,
        duration: performance.now() - started,
    };
}

/**
 * Runs a command to completion and returns its output. A missing executable is reported, never thrown.
 * @param command the executable and its arguments
 * @param options the working directory, environment, stdin and timeout
 * @returns the exit code, output and duration
 */
export async function run(command: string[], options: SpawnOptions): Promise<SpawnResult> {
    const started = performance.now();
    const [executable, ...argv] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    if (isWindows) return runOnWindows(executable, argv, options, started);
    try {
        return await spawnBun(command, options, started);
    } catch (error) {
        return failed(error, started);
    }
}

/**
 * Synchronous form for git plumbing and version probes.
 * @param command the executable and its arguments
 * @param options the working directory, environment and stdin
 * @returns the exit code, output and duration
 */
export function runBlocking(command: string[], options: SpawnOptions): SpawnResult {
    const started = performance.now();
    const [executable, ...argv] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    if (isWindows) return runBlockingOnWindows(executable, argv, options, started);
    try {
        return spawnBunBlocking(command, options, started);
    } catch (error) {
        return failed(error, started);
    }
}

/**
 * Runs git in a directory and returns stdout, or undefined when git fails.
 * @param root the directory
 * @param argv the git arguments
 * @returns stdout on success
 */
export function git(root: string, argv: string[]): string | undefined {
    const result = runBlocking(['git', ...argv], { cwd: root });
    return result.code === 0 ? result.stdout : undefined;
}
