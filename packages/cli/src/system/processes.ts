// Runs programs with cancellation, timeout, and output collection.
import { statSync } from 'node:fs';
import { onExit } from 'signal-exit';
import { execa, execaSync } from 'execa';
import { GspotError } from '#cli/system/errors.ts';
import type { ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import { dirname, resolve, delimiter, isAbsolute } from 'node:path';
import { buildSpawnEnvironment, readEnvironmentVariable } from '#cli/system/environment.ts';

import type {
    SpawnResult,
    SpawnOptions,
    StdoutReader,
    RunningProcess,
    SpawnCompletion,
    AsyncSpawnOptions,
    ProcessTermination,
    ProcessTreeControl,
} from '#cli/types/system/processes.ts';
import {
    FAILED_CODE,
    MISSING_CODE,
    PATHEXT_DEFAULT,
    PATH_SEPARATORS,
    TASKKILL_OPTIONS,
    TASKKILL_PROGRAM,
    TASKKILL_GONE_CODE,
    EXIT_CLEANUP_MILLISECONDS,
    OUTPUT_CLOSE_MILLISECONDS,
} from '#cli/config/system/processes.ts';

function buildExecaOptions(options: SpawnOptions, executable: string) {
    const env = buildSpawnEnvironment(options.env);
    // The launcher of a tool must find its sibling runtime and commands before unrelated tools on the executable search
    // path.
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
        buffer: true,
        stripFinalNewline: false,
        reject: false,
        maxBuffer: Infinity,
        killSignal: 'SIGKILL' as const,
    };
}

function buildAsyncExecaOptions(options: AsyncSpawnOptions, executable: string) {
    return {
        ...buildExecaOptions(options, executable),
        ...(options.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal }),
        detached: process.platform !== 'win32',
    };
}

// Check whether a command names a file that does not exist. Bare names resolve through the executable search path at
// spawn.
function isExecutableAbsent(executable: string, cwd: string): boolean {
    if (!PATH_SEPARATORS.test(executable)) return false;
    const path = resolve(cwd, executable);
    // Windows names an executable without its extension; the spawn shim tries each PATHEXT entry in turn.
    const extensions =
        process.platform === 'win32' ? (readEnvironmentVariable('PATHEXT') ?? PATHEXT_DEFAULT).split(';') : [];
    return [path, ...extensions.map((extension) => path + extension.toLowerCase())].every(
        (executablePath) => statSync(executablePath, { throwIfNoEntry: false }) === undefined,
    );
}

// A process that never ran, or stopped by a launch or stream error, reports a process failure, not a result.
function isUnfinished(result: SpawnCompletion): boolean {
    if (result.exitCode === undefined) return true;
    if (result.code !== undefined) return true;
    return result.cause !== undefined;
}

function buildSpawnResult(result: SpawnCompletion, started: number): SpawnResult {
    const missing = result.code === 'ENOENT';
    const unfinished = isUnfinished(result);
    const errored = result.failed && unfinished;
    const code = missing ? MISSING_CODE : (result.exitCode ?? FAILED_CODE);
    const messages: (string | undefined)[] = [result.stderr];
    if (unfinished) messages.push(result.shortMessage);
    return {
        // A run that errored can still report exit 0; report it as failed.
        code: errored && code === 0 ? FAILED_CODE : code,
        stdout: result.stdout ?? '',
        stderr: messages.filter(Boolean).join('\n'),
        missing,
        duration: performance.now() - started,
        timedOut: result.timedOut,
        canceled: result.isCanceled,
        errored,
    };
}

// The group has no process left to signal. macOS refuses the signal as not permitted, instead of reporting no such
// process, when every member has exited but still waits for system cleanup.
function isGroupGone(error: Error, child: ChildProcess): boolean {
    const hasExited = child.exitCode !== null || child.signalCode !== null;
    // taskkill exits nonzero for each tree member that ended while it ran; once the root has exited, the tree has too.
    if (error instanceof GspotError) return process.platform === 'win32' && hasExited;
    if (!('code' in error)) return false;
    if (error.code === 'ESRCH') return true;
    return error.code === 'EPERM' && process.platform === 'darwin' && hasExited;
}

function stopProcessTree(child: ChildProcess, termination: ProcessTermination): void {
    if (termination.stopped || child.pid === undefined) return;
    termination.stopped = true;
    try {
        if (process.platform === 'win32') {
            const result = execaSync(TASKKILL_PROGRAM, ['/pid', String(child.pid), ...TASKKILL_OPTIONS], {
                reject: false,
                timeout: OUTPUT_CLOSE_MILLISECONDS,
            });
            const code = result.exitCode ?? FAILED_CODE;
            if (![0, TASKKILL_GONE_CODE].includes(code))
                throw new GspotError('tool', `Cannot stop the tool and its child processes: ${result.stderr}`);
        } else process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
        if (!isGroupGone(error as Error, child)) termination.failure = error as Error;
    }
    child.kill('SIGKILL');
    termination.drainTimer = setTimeout(() => {
        const error = new Error(
            `Tool output did not close within ${String(OUTPUT_CLOSE_MILLISECONDS / MILLISECONDS_PER_SECOND)} seconds after gspot stopped the tool.`,
        );
        for (const stream of child.stdio) stream?.destroy(error);
    }, OUTPUT_CLOSE_MILLISECONDS);
}

/**
 * Watch a spawned process tree until its output and descendants finish.
 *
 * @param child the spawned process.
 * @param options the cancellation and timeout controls.
 * @returns how the process tree ended, and the cleanup step.
 */
function trackProcessTree(child: ChildProcess, options: AsyncSpawnOptions): ProcessTreeControl {
    const state = { timedOut: false, canceled: false };
    const termination: ProcessTermination = { stopped: false, failure: undefined, drainTimer: undefined };
    const stopTree = stopProcessTree.bind(undefined, child, termination);
    const stopOnAbort = () => {
        if (termination.stopped) return;
        state.canceled = true;
        stopTree();
    };
    const removeExitListener = onExit(stopTree);
    const timer =
        options.timeoutSeconds === undefined
            ? undefined
            : setTimeout(() => {
                  if (termination.stopped) return;
                  state.timedOut = true;
                  stopTree();
              }, options.timeoutSeconds * MILLISECONDS_PER_SECOND);
    let exitCleanup: Promise<void> | undefined;
    const startExitCleanup = () => {
        clearTimeout(timer);
        exitCleanup = delay(EXIT_CLEANUP_MILLISECONDS).then(() => {
            if (process.platform !== 'win32') stopTree();
            termination.stopped = true;
        });
    };
    const streams = child.stdio.filter((stream) => stream !== null && stream !== undefined);
    child.once('exit', startExitCleanup);
    for (const stream of streams) stream.once('error', stopTree);
    options.cancelSignal?.addEventListener('abort', stopOnAbort, { once: true });
    if (options.cancelSignal?.aborted === true) stopOnAbort();
    return {
        state,
        stop: stopTree,
        async release(executionFailure: unknown) {
            await exitCleanup;
            clearTimeout(timer);
            clearTimeout(termination.drainTimer);
            removeExitListener();
            options.cancelSignal?.removeEventListener('abort', stopOnAbort);
            child.removeListener('exit', startExitCleanup);
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

// Wait for a process, build its result, and stop its process tree. spawnProcess and streamProcess both end here.
async function completeProcess(
    child: RunningProcess,
    supervision: ProcessTreeControl,
    started: number,
    completion: PromiseLike<SpawnCompletion>,
): Promise<SpawnResult> {
    let executionFailure: unknown;
    try {
        const result = await completion;
        if (result.failed) executionFailure = new Error(result.shortMessage);
        return { ...buildSpawnResult(result, started), ...supervision.state };
    } catch (error) {
        executionFailure = error;
        supervision.stop();
        const result = await child;
        if (result.code === 'ENOENT') return { ...buildSpawnResult(result, started), ...supervision.state };
        throw error;
    } finally {
        await supervision.release(executionFailure);
    }
}

// The reader owns standard output bytes and checks cancellation after the stream ends.
async function readProcessOutput(
    child: RunningProcess,
    options: AsyncSpawnOptions,
    readStdout: StdoutReader,
): Promise<SpawnCompletion> {
    await readStdout({
        async *[Symbol.asyncIterator]() {
            yield* child.stdout;
            options.cancelSignal?.throwIfAborted();
        },
    });
    return child;
}

function splitCommand(command: readonly string[], cwd: string, started: number): [string, string[]] | SpawnResult {
    const [executable, ...commandArguments] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    return isExecutableAbsent(executable, cwd)
        ? // The executable file does not exist, so no process starts.
          buildSpawnResult(
              {
                  code: 'ENOENT',
                  failed: true,
                  shortMessage: `Executable not found: ${executable}`,
                  stdout: '',
                  stderr: '',
                  timedOut: false,
                  isCanceled: false,
              } satisfies SpawnCompletion,
              started,
          )
        : [executable, commandArguments];
}

function watchProcess(
    child: Omit<ChildProcess, 'stdout' | 'stderr'> & {
        stdout: RunningProcess['stdout'];
        stderr: RunningProcess['stdout'];
    },
    options: AsyncSpawnOptions,
): ProcessTreeControl {
    const supervision = trackProcessTree(child, options);
    if (options.onStdout !== undefined) child.stdout.on('data', options.onStdout);
    if (options.onStderr !== undefined) child.stderr.on('data', options.onStderr);
    return supervision;
}

/**
 * Run a supervised process tree and capture its text.
 *
 * @param command executable and literal arguments.
 * @param options where and how the process runs.
 * @returns captured output and termination status.
 */
export async function spawnProcess(command: readonly string[], options: AsyncSpawnOptions): Promise<SpawnResult> {
    const started = performance.now();
    const split = splitCommand(command, options.cwd, started);
    if (!Array.isArray(split)) return split;
    const [executable, commandArguments] = split;
    const child = execa(executable, commandArguments, buildAsyncExecaOptions(options, executable));
    const supervision = watchProcess(child, options);
    return completeProcess(child, supervision, started, child);
}

/**
 * Run a supervised process tree and read its output bytes.
 *
 * @param command executable and literal arguments.
 * @param options where and how the process runs.
 * @param readStdout reads the output bytes.
 * @returns output and termination status, with empty stdout when the callback reads it.
 */
export async function streamProcess(
    command: readonly string[],
    options: AsyncSpawnOptions,
    readStdout: StdoutReader,
): Promise<SpawnResult> {
    const started = performance.now();
    const split = splitCommand(command, options.cwd, started);
    if (!Array.isArray(split)) return split;
    const [executable, commandArguments] = split;
    const child = execa(executable, commandArguments, {
        ...buildAsyncExecaOptions(options, executable),
        buffer: { stdout: false },
    });
    const supervision = watchProcess(child, options);
    return completeProcess(child, supervision, started, readProcessOutput(child, options, readStdout));
}

/**
 * Run a process and wait. Git commands and version checks use it.
 *
 * @param command executable and literal arguments.
 * @param options where and how the process runs.
 * @returns captured output and termination status.
 */
export function spawnProcessBlocking(command: readonly string[], options: SpawnOptions): SpawnResult {
    const started = performance.now();
    const split = splitCommand(command, options.cwd, started);
    if (!Array.isArray(split)) return split;
    const [executable, commandArguments] = split;
    const deadline =
        options.timeoutSeconds === undefined ? {} : { timeout: options.timeoutSeconds * MILLISECONDS_PER_SECOND };
    const result = execaSync(executable, commandArguments, { ...buildExecaOptions(options, executable), ...deadline });
    return buildSpawnResult(result, started);
}
