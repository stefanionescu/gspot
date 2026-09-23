// Execa owns capture and platform shims; this boundary supervises each asynchronous process tree.
import { execa, execaSync, type Result } from 'execa';
import { onExit } from 'signal-exit';
import type { ChildProcess } from 'node:child_process';
import { environmentVariables } from '#cli/platform/environment.ts';
import { delimiter, dirname, isAbsolute } from 'node:path';
import type { AsyncSpawnOptions, SpawnResult, SpawnOptions, BinarySpawnResult } from '#cli/platform/types.ts';

const MISSING_CODE = 127;
const FAILED_CODE = 1;

function commandOptions(options: SpawnOptions, executable: string) {
    const env = { ...environmentVariables(), ...options.env };
    if (isAbsolute(executable) && env['PATH'] !== undefined)
        env['PATH'] = [dirname(executable), env['PATH']]
            .filter((value) => value !== undefined && value !== '')
            .join(delimiter);
    return {
        cwd: options.cwd,
        env,
        extendEnv: false,
        ...(options.stdin === undefined ? {} : { input: options.stdin }),
        stdio: [options.stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] as const,
        encoding: 'utf8' as const,
        stripFinalNewline: false,
        reject: false,
        maxBuffer: Infinity,
        killSignal: 'SIGKILL' as const,
        ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
    };
}

function completed(
    result: Pick<
        Result<{ encoding: 'utf8'; reject: false }>,
        'code' | 'exitCode' | 'failed' | 'shortMessage' | 'stdout' | 'stderr' | 'timedOut' | 'isCanceled'
    >,
    started: number,
    diagnostic = result.stderr,
): SpawnResult {
    const missing = result.code === 'ENOENT';
    const isErrored = result.failed && (result.exitCode === undefined || result.code !== undefined);
    const code = missing ? MISSING_CODE : (result.exitCode ?? FAILED_CODE);
    const failure = result.exitCode === undefined && result.failed ? result.shortMessage : undefined;
    const stderr = failure === undefined ? diagnostic : [diagnostic, failure].filter(Boolean).join('\n');
    return {
        code: isErrored && code === 0 ? FAILED_CODE : code,
        stdout: result.stdout,
        stderr,
        missing,
        duration: performance.now() - started,
        isTimedOut: result.timedOut,
        isCanceled: result.isCanceled,
        isErrored,
    };
}

function supervise(child: ChildProcess, options: AsyncSpawnOptions) {
    const state = { isTimedOut: false, isCanceled: false };
    let failure: Error | undefined;
    let stopped = false;
    const stopTree = () => {
        if (stopped || child.pid === undefined) return;
        stopped = true;
        try {
            if (process.platform === 'win32') {
                const result = execaSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
                    reject: false,
                    timeout: 5000,
                });
                if (result.exitCode !== 0 && result.exitCode !== 128)
                    throw new Error(`Cannot terminate the tool process tree: ${result.stderr}`);
            } else process.kill(-child.pid, 'SIGKILL');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
                failure = error instanceof Error ? error : new Error('Cannot terminate the tool process tree.');
        }
        child.kill('SIGKILL');
    };
    const cancel = () => {
        if (stopped) return;
        state.isCanceled = true;
        stopTree();
    };
    const removeExitHandler = onExit(stopTree);
    const timer =
        options.timeoutMs === undefined || options.timeoutMs === 0
            ? undefined
            : setTimeout(() => {
                  if (stopped) return;
                  state.isTimedOut = true;
                  stopTree();
              }, options.timeoutMs);
    const exited = () => {
        clearTimeout(timer);
        if (process.platform !== 'win32') stopTree();
        stopped = true;
    };
    child.once('exit', exited);
    for (const stream of child.stdio) stream?.once('error', stopTree);
    options.cancelSignal?.addEventListener('abort', cancel, { once: true });
    if (options.cancelSignal?.aborted === true) cancel();
    return {
        state,
        dispose() {
            clearTimeout(timer);
            removeExitHandler();
            options.cancelSignal?.removeEventListener('abort', cancel);
            child.removeListener('exit', exited);
            for (const stream of child.stdio) stream?.removeListener('error', stopTree);
            if (failure !== undefined) throw failure;
        },
    };
}

/**
 * Runs a command without a shell and preserves its streams and failure classification.
 * @param command executable and literal arguments
 * @param options working directory, environment, and process controls
 * @returns captured output and termination status
 */
export async function run(command: string[], options: AsyncSpawnOptions): Promise<SpawnResult> {
    const started = performance.now();
    const [executable, ...argv] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    const { timeout: _timeout, ...base } = commandOptions(options, executable);
    const child = execa(executable, argv, { ...base, detached: process.platform !== 'win32' });
    const supervision = supervise(child, options);
    if (options.onStdout !== undefined) child.stdout?.on('data', options.onStdout);
    if (options.onStderr !== undefined) child.stderr?.on('data', options.onStderr);
    try {
        const result = await child;
        return { ...completed(result, started), ...supervision.state };
    } finally {
        supervision.dispose();
    }
}

/**
 * Synchronous process execution for Git plumbing and version probes.
 * @param command executable and literal arguments
 * @param options working directory, environment, and process controls
 * @returns captured output and termination status
 */
export function runBlocking(command: string[], options: SpawnOptions): SpawnResult {
    const started = performance.now();
    const [executable, ...argv] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    return completed(execaSync(executable, argv, commandOptions(options, executable)), started);
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

/**
 * Capture binary tool output without decoding repository objects as text.
 * @param command executable and literal arguments
 * @param options working directory, environment, and process controls
 * @returns captured output and termination status
 */
export async function runBinary(command: string[], options: AsyncSpawnOptions): Promise<BinarySpawnResult> {
    const started = performance.now();
    const [executable, ...argv] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    const { timeout: _timeout, ...base } = commandOptions(options, executable);
    const child = execa(executable, argv, {
        ...base,
        detached: process.platform !== 'win32',
        // Bun requires a Node encoding name when it constructs child-process streams.
        encoding: 'base64',
    });
    const supervision = supervise(child, options);
    try {
        const result = await child;
        return {
            ...completed(result, started, Buffer.from(result.stderr, 'base64').toString('utf8')),
            ...supervision.state,
            stdout: Buffer.from(result.stdout, 'base64'),
        };
    } finally {
        supervision.dispose();
    }
}
