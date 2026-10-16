// Runs programs with cancellation, timeout, and output collection.
import { statSync } from 'node:fs';
import { onExit } from 'signal-exit';
import { execa, execaSync } from 'execa';
import { MS_PER_SECOND } from '#cli/config/units.ts';
import type { ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname, resolve, delimiter, isAbsolute } from 'node:path';
import { environmentVariable, environmentVariables } from '#cli/system/environment.ts';

import type {
    StdoutRead,
    SpawnResult,
    SpawnOptions,
    SpawnCompletion,
    AsyncSpawnOptions,
    ProcessTermination,
    ProcessTreeControl,
} from '#cli/types/system/processes.ts';
import {
    REAP_MS,
    DRAIN_MS,
    FAILED_CODE,
    MISSING_CODE,
    PATHEXT_DEFAULT,
    PATH_SEPARATORS,
    TASKKILL_PROGRAM,
    TASKKILL_OPTIONS,
    TASKKILL_GONE_CODE,
} from '#cli/config/system/processes.ts';

// Execa captures output and uses operating system shims. This boundary supervises each asynchronous process tree.

function commandOptions(options: SpawnOptions, executable: string, readStdout?: Exclude<StdoutRead, 'utf8'>) {
    const env = environmentVariables(options.env);
    // A selected tool's launcher must find its sibling runtime and commands before unrelated tools on the executable search path.
    const path = Object.keys(env).find((name) => (process.platform === 'win32' ? name.toUpperCase() : name) === 'PATH');
    if (isAbsolute(executable) && path !== undefined)
        env[path] = [dirname(executable), env[path]].filter((value) => value !== '').join(delimiter);
    return {
        cwd: options.cwd,
        env,
        extendEnv: false,
        ...(options.stdin === undefined ? {} : { input: options.stdin }),
        stdio: [options.stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] as const,
        encoding: 'utf8' as const,
        buffer: { stdout: readStdout === undefined },
        stripFinalNewline: false,
        reject: false,
        maxBuffer: Infinity,
        killSignal: 'SIGKILL' as const,
    };
}

// A command that names a file which does not exist. Resolve bare names through the executable search path at spawn.
function missingExecutable(executable: string, cwd: string): boolean {
    if (!PATH_SEPARATORS.test(executable)) return false;
    const path = resolve(cwd, executable);
    // Windows names an executable without its extension; the spawn shim tries each PATHEXT entry in turn.
    const extensions =
        process.platform === 'win32'
            ? (environmentVariable(environmentVariables(), 'PATHEXT') ?? PATHEXT_DEFAULT).split(';')
            : [];
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

// A process that never ran, or stopped by a launch or stream error, reports an execution error rather than a verdict.
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
// process, when every member has exited but still awaits operating system cleanup.
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
            const result = execaSync(TASKKILL_PROGRAM, ['/pid', String(child.pid), ...TASKKILL_OPTIONS], {
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

/**
 * Watch a spawned process tree until its output and descendants finish.
 * @param child the spawned process.
 * @param options the cancellation and timeout controls.
 * @returns completion state and the cleanup operation.
 */
function watchProcessTree(child: ChildProcess, options: AsyncSpawnOptions): ProcessTreeControl {
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
        options.timeoutMs === undefined
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
    const streams = child.stdio.filter((stream) => stream !== null && stream !== undefined);
    child.once('exit', exited);
    for (const stream of streams) stream.once('error', stopTree);
    options.cancelSignal?.addEventListener('abort', cancel, { once: true });
    if (options.cancelSignal?.aborted === true) cancel();
    return {
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
            throw executionFailure === undefined
                ? termination.failure
                : new AggregateError(
                      [executionFailure, termination.failure],
                      'Tool execution and process cleanup failed.',
                  );
        },
    };
}

/**
 * Run one supervised process tree and capture its text or stream its output.
 * @param command executable and literal arguments.
 * @param options working directory, environment, and process controls.
 * @param output text capture or a callback that reads output bytes.
 * @returns output and termination status, with empty stdout when the callback reads it.
 */
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- reason: Process supervision keeps stream failures, cancellation, and child cleanup in one try/finally boundary.
export async function run(
    command: readonly string[],
    options: AsyncSpawnOptions,
    output: StdoutRead = 'utf8',
): Promise<SpawnResult> {
    const started = performance.now();
    const [executable, ...argv] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    if (missingExecutable(executable, options.cwd)) return completed(notFound(executable), started, '');
    const readStdout = output === 'utf8' ? undefined : output;
    const child = execa(executable, argv, {
        ...commandOptions(options, executable, readStdout),
        ...(options.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal }),
        detached: process.platform !== 'win32',
    });
    const supervision = watchProcessTree(child, options);
    if (options.onStdout !== undefined) child.stdout.on('data', options.onStdout);
    if (options.onStderr !== undefined) child.stderr.on('data', options.onStderr);
    let executionFailure: unknown;
    try {
        if (readStdout !== undefined) {
            await readStdout({
                async *[Symbol.asyncIterator]() {
                    yield* child.stdout;
                    options.cancelSignal?.throwIfAborted();
                },
            });
        }
        const result = await child;
        if (result.failed) executionFailure = new Error(result.shortMessage);
        const diagnostic = result.stderr;
        return { ...completed(result, started, diagnostic), ...supervision.state };
    } catch (error) {
        executionFailure = error;
        supervision.stop();
        const result = await child;
        if (result.code === 'ENOENT') return { ...completed(result, started, result.stderr), ...supervision.state };
        throw error;
    } finally {
        await supervision.dispose(executionFailure);
    }
}

/**
 * Synchronous process execution for Git plumbing and version inspections.
 * @param command executable and literal arguments.
 * @param options working directory, environment, and process controls.
 * @returns captured output and termination status.
 */
export function runBlocking(command: readonly string[], options: SpawnOptions): SpawnResult {
    const started = performance.now();
    const [executable, ...argv] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    if (missingExecutable(executable, options.cwd)) return completed(notFound(executable), started, '');
    const deadline = options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs };
    const result = execaSync(executable, argv, { ...commandOptions(options, executable), ...deadline });
    return completed(result, started, result.stderr);
}
