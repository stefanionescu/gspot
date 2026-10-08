// Execa owns capture and platform shims; this boundary supervises each asynchronous process tree.
import { statSync } from 'node:fs';
import { onExit } from 'signal-exit';
import { execa, execaSync } from 'execa';
import type { ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname, resolve, delimiter, isAbsolute } from 'node:path';
import { environmentVariables } from '#cli/platform/environment.ts';

import {
    REAP_MS,
    DRAIN_MS,
    FAILED_CODE,
    MISSING_CODE,
    MS_PER_SECOND,
    TASKKILL_GONE_CODE,
} from '#cli/config/platform/runtime.ts';
import type {
    StdoutRead,
    SpawnResult,
    SpawnOptions,
    SpawnCompletion,
    AsyncSpawnOptions,
    BinarySpawnResult,
    ProcessTermination,
} from '#cli/types/platform/runtime.ts';

function commandOptions(options: SpawnOptions, executable: string, output: StdoutRead) {
    const env = { ...environmentVariables(), ...options.env };
    // A selected tool's launcher must find its sibling runtime and commands before unrelated PATH tools.
    if (isAbsolute(executable) && env['PATH'] !== undefined)
        env['PATH'] = [dirname(executable), env['PATH']].filter((value) => value !== '').join(delimiter);
    return {
        cwd: options.cwd,
        env,
        extendEnv: false,
        ...(options.stdin === undefined ? {} : { input: options.stdin }),
        stdio: [options.stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] as const,
        encoding: typeof output === 'string' ? output : 'utf8',
        buffer: { stdout: typeof output === 'string' },
        stripFinalNewline: false,
        reject: false,
        maxBuffer: Infinity,
        killSignal: 'SIGKILL' as const,
    };
}

// A command that names a file which does not exist. A bare name is left to PATH lookup at spawn time.
function missingExecutable(executable: string, cwd: string): boolean {
    if (!/[\\/]/u.test(executable)) return false;
    const path = resolve(cwd, executable);
    // Windows names an executable without its extension; the spawn shim tries each PATHEXT entry in turn.
    const extensions =
        process.platform === 'win32' ? (environmentVariables()['PATHEXT'] ?? '.COM;.EXE;.BAT;.CMD').split(';') : [];
    return [path, ...extensions.map((extension) => path + extension.toLowerCase())].every(
        (candidate) => statSync(candidate, { throwIfNoEntry: false }) === undefined,
    );
}

// The result of a command whose executable file does not exist, decided before any process starts.

function notFound(executable: string): SpawnCompletion {
    return {
        code: 'ENOENT',
        failed: true,
        shortMessage: `Executable not found: ${executable}`,
        stdout: '',
        stderr: '',
        timedOut: false,
        isCanceled: false,
    };
}

// A process that never ran, or that a launch or stream error stopped, is an execution error and not a verdict.
function isUnfinished(result: SpawnCompletion): boolean {
    if (result.exitCode === undefined) return true;
    if (result.code !== undefined) return true;
    return result.cause !== undefined;
}

function completed(result: SpawnCompletion, started: number, diagnostic: string): SpawnResult {
    const missing = result.code === 'ENOENT';
    const unfinished = isUnfinished(result);
    const isErrored = result.failed && unfinished;
    const code = missing ? MISSING_CODE : (result.exitCode ?? FAILED_CODE);
    const diagnostics: (string | undefined)[] = [diagnostic];
    if (unfinished) diagnostics.push(result.shortMessage);
    return {
        // A run that errored can still report exit 0; report it as failed.
        code: isErrored && code === 0 ? FAILED_CODE : code,
        stdout: result.stdout ?? '',
        stderr: diagnostics.filter(Boolean).join('\n'),
        missing,
        duration: performance.now() - started,
        isTimedOut: result.timedOut,
        isCanceled: result.isCanceled,
        isErrored,
    };
}

// The group has no process left to signal. macOS refuses the signal as not permitted, rather than reporting no such
// process, when every member has exited but is not reaped yet.
function isGroupGone(error: Error, child: ChildProcess): boolean {
    if (!('code' in error)) return false;
    if (error.code === 'ESRCH') return true;
    const hasExited = child.exitCode !== null || child.signalCode !== null;
    return error.code === 'EPERM' && process.platform === 'darwin' && hasExited;
}

function terminate(child: ChildProcess, state: ProcessTermination): void {
    if (state.stopped || child.pid === undefined) return;
    state.stopped = true;
    try {
        if (process.platform === 'win32') {
            const result = execaSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
                reject: false,
                timeout: DRAIN_MS,
            });
            const code = result.exitCode ?? FAILED_CODE;
            if (![0, TASKKILL_GONE_CODE].includes(code))
                throw new Error(`Cannot terminate the tool process tree: ${result.stderr}`);
        } else process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
        if (!isGroupGone(error as Error, child)) state.failure = error as Error;
    }
    child.kill('SIGKILL');
    state.drainTimer = setTimeout(() => {
        const error = new Error(
            `Tool output did not close within ${String(DRAIN_MS / MS_PER_SECOND)} seconds after termination.`,
        );
        for (const stream of child.stdio) stream?.destroy(error);
    }, DRAIN_MS);
}

function supervise(executable: string, argv: string[], options: AsyncSpawnOptions, output: StdoutRead) {
    const base = commandOptions(options, executable, output);
    const child = execa(executable, argv, {
        ...base,
        ...(options.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal }),
        detached: process.platform !== 'win32',
    });
    const state = { isTimedOut: false, isCanceled: false };
    const termination: ProcessTermination = { stopped: false, failure: undefined, drainTimer: undefined };
    const stopTree = terminate.bind(undefined, child, termination);
    const cancel = () => {
        if (termination.stopped) return;
        state.isCanceled = true;
        stopTree();
    };
    const removeExitListener = onExit(stopTree);
    const timer =
        options.timeoutMs === undefined || options.timeoutMs === 0
            ? undefined
            : setTimeout(() => {
                  if (termination.stopped) return;
                  state.isTimedOut = true;
                  stopTree();
              }, options.timeoutMs);
    let exitCleanup: Promise<void> | undefined;
    const exited = () => {
        clearTimeout(timer);
        exitCleanup = delay(REAP_MS).then(() => {
            if (process.platform !== 'win32') stopTree();
            termination.stopped = true;
        });
    };
    const streams = child.stdio.filter((stream) => stream !== null);
    child.once('exit', exited);
    for (const stream of streams) stream.once('error', stopTree);
    options.cancelSignal?.addEventListener('abort', cancel, { once: true });
    if (options.cancelSignal?.aborted === true) cancel();
    return {
        child,
        encoding: base.encoding,
        state,
        stop: stopTree,
        async dispose(executionFailure: unknown) {
            await exitCleanup;
            clearTimeout(timer);
            clearTimeout(termination.drainTimer);
            removeExitListener();
            options.cancelSignal?.removeEventListener('abort', cancel);
            child.removeListener('exit', exited);
            for (const stream of streams) stream.removeListener('error', stopTree);
            if (termination.failure === undefined || isGroupGone(termination.failure, child)) return;
            if (executionFailure !== undefined)
                throw new AggregateError(
                    [executionFailure, termination.failure],
                    'Tool execution and process cleanup failed.',
                );
            throw termination.failure;
        },
    };
}

/**
 * Run one supervised process tree with encoded capture or an uncaptured raw consumer.
 * @param command executable and literal arguments
 * @param options working directory, environment, and process controls
 * @param output encoding or the consumer that drains binary output
 * @returns output and termination classification, with empty stdout for an uncaptured consumer
 */
export async function runStream(
    command: string[],
    options: AsyncSpawnOptions,
    output: StdoutRead,
): Promise<SpawnResult> {
    const started = performance.now();
    const [executable, ...argv] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    if (missingExecutable(executable, options.cwd)) return completed(notFound(executable), started, '');
    const supervision = supervise(executable, argv, options, output);
    const { child, encoding } = supervision;
    if (options.onStdout !== undefined) child.stdout.on('data', options.onStdout);
    if (options.onStderr !== undefined) child.stderr.on('data', options.onStderr);
    let executionFailure: unknown;
    try {
        if (typeof output === 'function') {
            await output({
                async *[Symbol.asyncIterator]() {
                    yield* child.stdout;
                    options.cancelSignal?.throwIfAborted();
                },
            });
        }
        const result = await child;
        if (result.failed) executionFailure = new Error(result.shortMessage);
        const diagnostic = Buffer.from(result.stderr, encoding).toString('utf8');
        return { ...completed(result, started, diagnostic), ...supervision.state };
    } catch (error) {
        executionFailure = error;
        supervision.stop();
        await child;
        throw error;
    } finally {
        await supervision.dispose(executionFailure);
    }
}

/**
 * Runs a command without a shell and preserves its streams and failure classification.
 * @param command executable and literal arguments
 * @param options working directory, environment, and process controls
 * @returns captured output and termination status
 */
export async function run(command: string[], options: AsyncSpawnOptions): Promise<SpawnResult> {
    return await runStream(command, options, 'utf8');
}

/**
 * Synchronous process execution for Git plumbing and version inspections.
 * @param command executable and literal arguments
 * @param options working directory, environment, and process controls
 * @returns captured output and termination status
 */
export function runBlocking(command: string[], options: SpawnOptions): SpawnResult {
    const started = performance.now();
    const [executable, ...argv] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    if (missingExecutable(executable, options.cwd)) return completed(notFound(executable), started, '');
    const deadline = options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs };
    const result = execaSync(executable, argv, { ...commandOptions(options, executable, 'utf8'), ...deadline });
    return completed(result, started, result.stderr);
}

/**
 * Capture binary tool output without decoding repository objects as text.
 * @param command executable and literal arguments
 * @param options working directory, environment, and process controls
 * @returns captured output and termination status
 */
export async function runBinary(command: string[], options: AsyncSpawnOptions): Promise<BinarySpawnResult> {
    // Bun requires a Node encoding name when it constructs child-process streams, so the bytes arrive as base64.
    const result = await runStream(command, options, 'base64');
    return { ...result, stdout: Buffer.from(result.stdout, 'base64') };
}
