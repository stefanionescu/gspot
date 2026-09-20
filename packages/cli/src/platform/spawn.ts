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
        code: code === 'ENOENT' ? MISSING_CODE : FAILED_CODE,
        stdout: '',
        stderr: text,
        missing: code === 'ENOENT',
        duration: performance.now() - started,
    };
}

function capturedText(output: string | null, error?: Error | null): string {
    const text = output ?? '';
    if (error === undefined || error === null) return text;
    return text === '' ? error.message : `${text}\n${error.message}`;
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
                  if (proc.exitCode !== null || proc.signalCode !== null) return;
                  state.isTimedOut = true;
                  proc.kill('SIGKILL');
              }, options.timeoutMs);
    try {
        const [stdout, stderr, code] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited,
        ]);
        return {
            code,
            stdout,
            stderr,
            missing: false,
            duration: performance.now() - started,
            isTimedOut: state.isTimedOut,
        };
    } catch (error) {
        if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
        await proc.exited;
        throw error;
    } finally {
        clearTimeout(timer);
    }
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
 * Executes the cross-spawn backend used on Windows.
 * @param executable the resolved program
 * @param argv its arguments
 * @param options working directory, input, environment, and deadline
 * @param started the monotonic start time
 * @returns the completed status and captured streams
 */
export function runOnWindows(
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
        });
        let launchError: NodeJS.ErrnoException | undefined;
        let isTimedOut = false;
        const timer =
            options.timeoutMs === undefined
                ? undefined
                : setTimeout(() => {
                      if (child.exitCode !== null || child.signalCode !== null) return;
                      isTimedOut = true;
                      child.kill('SIGKILL');
                  }, options.timeoutMs);
        const out: Buffer[] = [];
        const error: Buffer[] = [];
        child.stdout?.on('data', (chunk: Buffer) => {
            out.push(chunk);
        });
        child.stderr?.on('data', (chunk: Buffer) => {
            error.push(chunk);
        });
        child.on('error', (spawnError: NodeJS.ErrnoException) => {
            launchError = spawnError;
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            const result: SpawnResult = {
                isTimedOut,
                code: code ?? FAILED_CODE,
                stdout: Buffer.concat(out).toString('utf8'),
                stderr: capturedText(Buffer.concat(error).toString('utf8'), launchError),
                missing: false,
                duration: performance.now() - started,
            };
            if (launchError !== undefined) {
                const failure = failed(launchError, started);
                result.code = failure.code;
                result.missing = failure.missing;
            }
            settle(result);
        });
        if (options.stdin === undefined) child.stdin?.end();
        else child.stdin?.end(options.stdin);
    });
}

/**
 * Executes the synchronous cross-spawn backend used on Windows.
 * @param executable the resolved program
 * @param argv its arguments
 * @param options working directory, input, environment, and deadline
 * @param started the monotonic start time
 * @returns the completed status and captured streams
 */
export function runBlockingOnWindows(
    executable: string,
    argv: string[],
    options: SpawnOptions,
    started: number,
): SpawnResult {
    const result = crossSpawn.sync(executable, argv, {
        cwd: options.cwd,
        env: environment(options.env),
        input: options.stdin,
        encoding: 'utf8',
        maxBuffer: Infinity,
        killSignal: 'SIGKILL',
        ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
    });
    const errorCode = (result.error as NodeJS.ErrnoException | undefined)?.code;
    const isMissing = errorCode === 'ENOENT';
    return {
        code: result.status ?? (isMissing ? MISSING_CODE : FAILED_CODE),
        stdout: capturedText(result.stdout),
        stderr: capturedText(result.stderr, result.error),
        isTimedOut: errorCode === 'ETIMEDOUT',
        missing: isMissing,
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
    try {
        if (isWindows) return await runOnWindows(executable, argv, options, started);
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
    try {
        if (isWindows) return runBlockingOnWindows(executable, argv, options, started);
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

/**
 * Reads a Git configuration value, distinguishing an unset key from a failed command.
 * @param root the working directory
 * @param key the configuration key
 * @returns the exact value, or undefined when the key is unset
 */
export function readGitSetting(root: string, key: string): string | undefined {
    const result = runBlocking(['git', 'config', '--null', '--get', key], { cwd: root });
    if (result.code === 0) return result.stdout.slice(0, -1);
    if (result.code === 1 && result.stdout === '' && result.stderr === '') return undefined;
    throw new Error(
        `Git configuration ${key} failed in ${root} (exit ${String(result.code)}): ${result.stderr.trim()}`,
    );
}
