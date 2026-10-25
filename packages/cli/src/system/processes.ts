import { statSync } from 'node:fs';
import { onExit } from 'signal-exit';
import { execa, execaSync } from 'execa';
import type { ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { dirname, resolve, delimiter, isAbsolute } from 'node:path';
import { foldVariableName, buildSpawnEnvironment, readEnvironmentVariable } from '#cli/system/environment.ts';

import type {
    SpawnResult,
    SpawnOptions,
    StdoutReader,
    RunningProcess,
    WatchedProcess,
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
    const env: Record<string, string | undefined> = { ...buildSpawnEnvironment(options.env), PWD: options.cwd };
    const path = Object.keys(env).find((name) => foldVariableName(name) === 'PATH');
    if (path !== undefined && isAbsolute(executable))
        env[path] = [dirname(executable), env[path]].filter((value) => value !== '').join(delimiter);
    return {
        cwd: options.cwd,
        env,
        extendEnv: false,
        ...(options.stdin !== undefined && { input: options.stdin }),
        stdio: [options.stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] as const,
        encoding: 'utf8' as const,
        buffer: true,
        stripFinalNewline: false,
        reject: false,
        maxBuffer: Infinity,
        killSignal: 'SIGKILL' as const,
    };
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function buildAsyncExecaOptions(options: AsyncSpawnOptions, executable: string) {
    return {
        ...buildExecaOptions(options, executable),
        ...(options.cancelSignal !== undefined && { cancelSignal: options.cancelSignal }),
        detached: process.platform !== 'win32',
    };
}

function isExecutableAbsent(executable: string, cwd: string): boolean {
    if (!PATH_SEPARATORS.test(executable)) return false;
    const path = resolve(cwd, executable);
    const extensions =
        process.platform === 'win32' ? (readEnvironmentVariable('PATHEXT') ?? PATHEXT_DEFAULT).split(';') : [];
    return [path, ...extensions.map((extension) => path + extension.toLowerCase())].every(
        (executablePath) => statSync(executablePath, { throwIfNoEntry: false }) === undefined,
    );
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function isUnfinished(result: SpawnCompletion): boolean {
    return result.exitCode === undefined || result.code !== undefined || result.cause !== undefined;
}

function buildSpawnResult(result: SpawnCompletion, started: number): SpawnResult {
    const isMissing = result.code === 'ENOENT';
    const isUnfinishedResult = isUnfinished(result);
    const errored = result.failed && isUnfinishedResult;
    const code = isMissing ? MISSING_CODE : (result.exitCode ?? FAILED_CODE);
    const messages: (string | undefined)[] = [result.stderr];
    if (isUnfinishedResult) messages.push(result.shortMessage);
    return {
        code: errored && code === 0 ? FAILED_CODE : code,
        stdout: result.stdout ?? '',
        stderr: messages.filter(Boolean).join('\n'),
        missing: isMissing,
        duration: Math.round(performance.now() - started),
        timedOut: result.timedOut,
        canceled: result.isCanceled,
        errored,
    };
}

function isGroupGone(error: Error, child: ChildProcess): boolean {
    const hasExited = child.exitCode !== null || child.signalCode !== null;
    if (error instanceof GspotError) return process.platform === 'win32' && hasExited;
    if (hasErrorCode(error, 'ESRCH')) return true;
    return hasErrorCode(error, 'EPERM') && process.platform === 'darwin' && hasExited;
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
        exitCleanup = (async () => {
            await delay(EXIT_CLEANUP_MILLISECONDS);
            if (process.platform !== 'win32') stopTree();
            termination.stopped = true;
        })();
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

async function finishProcess(
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

async function readProcessOutput(
    child: RunningProcess,
    options: AsyncSpawnOptions,
    readStdout: StdoutReader,
): Promise<SpawnCompletion> {
    await readStdout({
        // eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
        async *[Symbol.asyncIterator]() {
            yield* child.stdout;
            options.cancelSignal?.throwIfAborted();
        },
    });
    return child;
}

function findMissingExecutable(command: readonly string[], cwd: string, started: number): SpawnResult | undefined {
    const executable = command[0];
    if (executable === undefined) throw new Error('An empty command cannot run.');
    if (!isExecutableAbsent(executable, cwd)) return undefined;
    return buildSpawnResult(
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
    );
}

function watchProcess(child: WatchedProcess, options: AsyncSpawnOptions): ProcessTreeControl {
    const supervision = trackProcessTree(child, options);
    if (options.onStdout !== undefined) child.stdout.on('data', options.onStdout);
    if (options.onStderr !== undefined) child.stderr.on('data', options.onStderr);
    return supervision;
}

/**
Run a supervised process tree and capture its text.

@param command executable and literal arguments.
@param options where and how the process runs.
@returns captured output and termination status.
*/
export async function spawnProcess(command: readonly string[], options: AsyncSpawnOptions): Promise<SpawnResult> {
    const started = performance.now();
    const missing = findMissingExecutable(command, options.cwd, started);
    if (missing !== undefined) return missing;
    const [executable, ...commandArguments] = command as readonly [string, ...string[]];
    const child = execa(executable, commandArguments, buildAsyncExecaOptions(options, executable));
    const supervision = watchProcess(child, options);
    return finishProcess(child, supervision, started, child);
}

/**
Run a supervised process tree and read its output bytes.

@param command executable and literal arguments.
@param options where and how the process runs.
@param readStdout reads the output bytes.
@returns output and termination status, with empty stdout when the callback reads it.
*/
export async function streamProcess(
    command: readonly string[],
    options: AsyncSpawnOptions,
    readStdout: StdoutReader,
): Promise<SpawnResult> {
    const started = performance.now();
    const missing = findMissingExecutable(command, options.cwd, started);
    if (missing !== undefined) return missing;
    const [executable, ...commandArguments] = command as readonly [string, ...string[]];
    const child = execa(executable, commandArguments, {
        ...buildAsyncExecaOptions(options, executable),
        buffer: { stdout: false },
    });
    const supervision = watchProcess(child, options);
    return finishProcess(child, supervision, started, readProcessOutput(child, options, readStdout));
}

/**
Run a process and wait. Git commands and version checks use it.

@param command executable and literal arguments.
@param options where and how the process runs.
@returns captured output and termination status.
*/
export function spawnProcessBlocking(command: readonly string[], options: SpawnOptions): SpawnResult {
    const started = performance.now();
    const missing = findMissingExecutable(command, options.cwd, started);
    if (missing !== undefined) return missing;
    const [executable, ...commandArguments] = command as readonly [string, ...string[]];
    const deadline =
        options.timeoutSeconds === undefined ? {} : { timeout: options.timeoutSeconds * MILLISECONDS_PER_SECOND };
    const result = execaSync(executable, commandArguments, { ...buildExecaOptions(options, executable), ...deadline });
    return buildSpawnResult(result, started);
}
