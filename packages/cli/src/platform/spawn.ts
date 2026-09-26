import { onExit } from 'signal-exit';
// Execa owns capture and platform shims; this boundary supervises each asynchronous process tree.
import { execa, execaSync, type Result } from 'execa';
import type { ChildProcess } from 'node:child_process';
import { delimiter, dirname, isAbsolute } from 'node:path';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { AsyncSpawnOptions, BinarySpawnResult, SpawnOptions, SpawnResult } from '#cli/types/platform.ts';
import { DRAIN_MS, FAILED_CODE, MISSING_CODE, REAP_MS, TASKKILL_GONE_CODE } from '#cli/constants/platform.ts';

function commandOptions(options: SpawnOptions, executable: string) {
    const env = { ...environmentVariables(), ...options.env };
    if (isAbsolute(executable) && env['PATH'] !== undefined)
        env['PATH'] = [dirname(executable), env['PATH']].filter((value) => value !== '').join(delimiter);
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
    let drainTimer: ReturnType<typeof setTimeout> | undefined;
    const stopTree = () => {
        if (stopped || child.pid === undefined) return;
        stopped = true;
        try {
            if (process.platform === 'win32') {
                const result = execaSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
                    reject: false,
                    timeout: DRAIN_MS,
                });
                if (result.exitCode !== 0 && result.exitCode !== TASKKILL_GONE_CODE)
                    throw new Error(`Cannot terminate the tool process tree: ${result.stderr}`);
            } else process.kill(-child.pid, 'SIGKILL');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
                failure = error instanceof Error ? error : new Error('Cannot terminate the tool process tree.');
        }
        child.kill('SIGKILL');
        drainTimer = setTimeout(() => {
            const error = new Error('Tool output did not close within 5 seconds after termination.');
            for (const stream of child.stdio) stream?.destroy(error);
        }, DRAIN_MS);
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
    let exitCleanup: Promise<void> | undefined;
    const exited = () => {
        clearTimeout(timer);
        exitCleanup = new Promise((resolve) => {
            setTimeout(() => {
                if (process.platform !== 'win32') stopTree();
                stopped = true;
                resolve();
            }, REAP_MS);
        });
    };
    child.once('exit', exited);
    for (const stream of child.stdio) stream?.once('error', stopTree);
    options.cancelSignal?.addEventListener('abort', cancel, { once: true });
    if (options.cancelSignal?.aborted === true) cancel();
    return {
        state,
        async dispose(executionFailure: Error | undefined) {
            await exitCleanup;
            clearTimeout(timer);
            clearTimeout(drainTimer);
            removeExitHandler();
            options.cancelSignal?.removeEventListener('abort', cancel);
            child.removeListener('exit', exited);
            for (const stream of child.stdio) stream?.removeListener('error', stopTree);
            if (failure !== undefined) {
                if (executionFailure !== undefined)
                    throw new AggregateError([executionFailure, failure], 'Tool execution and process cleanup failed.');
                throw failure;
            }
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
    const base = commandOptions(options, executable);
    const child = execa(executable, argv, { ...base, detached: process.platform !== 'win32' });
    const supervision = supervise(child, options);
    if (options.onStdout !== undefined) child.stdout.on('data', options.onStdout);
    if (options.onStderr !== undefined) child.stderr.on('data', options.onStderr);
    let executionFailure: Error | undefined;
    try {
        const result = await child;
        if (result.failed) executionFailure = new Error(result.shortMessage);
        return { ...completed(result, started), ...supervision.state };
    } catch (error) {
        executionFailure = error instanceof Error ? error : new Error(String(error));
        throw error;
    } finally {
        await supervision.dispose(executionFailure);
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
    const deadline = options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs };
    return completed(execaSync(executable, argv, { ...commandOptions(options, executable), ...deadline }), started);
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
    const base = commandOptions(options, executable);
    const child = execa(executable, argv, {
        ...base,
        detached: process.platform !== 'win32',
        // Bun requires a Node encoding name when it constructs child-process streams.
        encoding: 'base64',
    });
    const supervision = supervise(child, options);
    let executionFailure: Error | undefined;
    try {
        const result = await child;
        if (result.failed) executionFailure = new Error(result.shortMessage);
        return {
            ...completed(result, started, Buffer.from(result.stderr, 'base64').toString('utf8')),
            ...supervision.state,
            stdout: Buffer.from(result.stdout, 'base64'),
        };
    } catch (error) {
        executionFailure = error instanceof Error ? error : new Error(String(error));
        throw error;
    } finally {
        await supervision.dispose(executionFailure);
    }
}
