// Execa owns capture and platform shims; this boundary supervises each asynchronous process tree.
import { statSync } from 'node:fs';
import { onExit } from 'signal-exit';
import { execa, execaSync } from 'execa';
import type { ChildProcess } from 'node:child_process';
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
    SpawnResult,
    SpawnOptions,
    SpawnCompletion,
    AsyncSpawnOptions,
    BinarySpawnResult,
    ProcessTermination,
} from '#cli/types/platform/runtime.ts';

function commandOptions(options: SpawnOptions, executable: string) {
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
        encoding: 'utf8' as const,
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
        stdout: result.stdout,
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
function isGroupGone(error: NodeJS.ErrnoException, child: ChildProcess): boolean {
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
        if (!isGroupGone(error as NodeJS.ErrnoException, child)) state.failure = error as Error;
    }
    child.kill('SIGKILL');
    state.drainTimer = setTimeout(() => {
        const error = new Error(
            `Tool output did not close within ${String(DRAIN_MS / MS_PER_SECOND)} seconds after termination.`,
        );
        for (const stream of child.stdio) stream?.destroy(error);
    }, DRAIN_MS);
}

function supervise(child: ChildProcess, options: AsyncSpawnOptions) {
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
        exitCleanup = new Promise((complete) => {
            setTimeout(() => {
                if (process.platform !== 'win32') stopTree();
                termination.stopped = true;
                complete();
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
            clearTimeout(termination.drainTimer);
            removeExitListener();
            options.cancelSignal?.removeEventListener('abort', cancel);
            child.removeListener('exit', exited);
            for (const stream of child.stdio) stream?.removeListener('error', stopTree);
            if (termination.failure !== undefined) {
                if (executionFailure !== undefined)
                    throw new AggregateError(
                        [executionFailure, termination.failure],
                        'Tool execution and process cleanup failed.',
                    );
                throw termination.failure;
            }
        },
    };
}

// Runs a command without a shell under supervision. Standard output stays in the encoding the caller reads, and the
// diagnostics are decoded to text.
async function supervisedRun(
    command: string[],
    options: AsyncSpawnOptions,
    encoding: 'utf8' | 'base64',
): Promise<SpawnResult> {
    const started = performance.now();
    const [executable, ...argv] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    if (missingExecutable(executable, options.cwd)) return completed(notFound(executable), started, '');
    const base = commandOptions(options, executable);
    const child = execa(executable, argv, { ...base, detached: process.platform !== 'win32', encoding });
    const supervision = supervise(child, options);
    if (options.onStdout !== undefined) child.stdout.on('data', options.onStdout);
    if (options.onStderr !== undefined) child.stderr.on('data', options.onStderr);
    let executionFailure: Error | undefined;
    try {
        const result = await child;
        if (result.failed) executionFailure = new Error(result.shortMessage);
        const diagnostic = Buffer.from(result.stderr, encoding).toString('utf8');
        return { ...completed(result, started, diagnostic), ...supervision.state };
    } catch (error) {
        executionFailure = error instanceof Error ? error : new Error(String(error));
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
    return await supervisedRun(command, options, 'utf8');
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
    const result = execaSync(executable, argv, { ...commandOptions(options, executable), ...deadline });
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
    const result = await supervisedRun(command, options, 'base64');
    return { ...result, stdout: Buffer.from(result.stdout, 'base64') };
}
