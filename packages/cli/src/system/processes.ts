import { statSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, resolve } from 'node:path';

import { execa, type Options } from 'execa';

import {
    CANCELED_START_MESSAGE,
    EMPTY_COMMAND_MESSAGE,
    FAILED_CODE,
    MISSING_CODE,
    OUTPUT_LIMIT,
    PATH_SEPARATORS,
    PATHEXT_DEFAULT,
} from '#cli/config/system.ts';
import { buildSpawnEnvironment, foldVariableName, readEnvironmentVariable } from '#cli/system/environment.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { trackProcessTree } from '#cli/system/process-trees.ts';
import { findProgramCommand } from '#cli/system/programs.ts';
import type {
    CancelableSpawnOptions,
    ProcessEnd,
    ProcessTreeControl,
    ProcessTreeState,
    RunningProcess,
    SpawnCompletion,
    SpawnOptions,
    SpawnResult,
    StdoutReader,
} from '#cli/types/system.ts';

const UNSTARTED_COMPLETION = { failed: true, stdout: '', stderr: '' } as const;

const UNSTOPPED = { timedOut: false, canceled: false } as const;

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
        maxBuffer: OUTPUT_LIMIT,
    };
}

function isExecutableFilePresent(executable: string, cwd: string): boolean {
    // A bare command name has no path to test, so the program lookup decides.
    if (!PATH_SEPARATORS.test(executable)) return true;
    const path = resolve(cwd, executable);
    const extensions =
        process.platform === 'win32' ? (readEnvironmentVariable('PATHEXT') ?? PATHEXT_DEFAULT).split(';') : [];
    return [path, ...extensions.map((extension) => path + extension.toLowerCase())].some(
        (executablePath) => statSync(executablePath, { throwIfNoEntry: false }) !== undefined,
    );
}

function selectProcessEnd(stop: ProcessTreeState, completion: { isMissing: boolean; isErrored: boolean }): ProcessEnd {
    if (stop.canceled) return 'canceled';
    if (stop.timedOut) return 'timed-out';
    if (completion.isMissing) return 'missing';
    return completion.isErrored ? 'failed' : 'exited';
}

function buildSpawnResult(result: SpawnCompletion, started: number, stop: ProcessTreeState): SpawnResult {
    const isMissing = result.code === 'ENOENT';
    const isUnfinishedResult = [
        result.exitCode === undefined,
        result.code !== undefined,
        result.cause !== undefined,
    ].includes(true);
    const isErrored = result.failed && isUnfinishedResult;
    const code = isMissing ? MISSING_CODE : (result.exitCode ?? FAILED_CODE);
    const messages: Array<string | undefined> = [result.stderr];
    if (isUnfinishedResult) messages.push(result.shortMessage);
    return {
        code: isErrored && code === 0 ? FAILED_CODE : code,
        signal: result.signal,
        stdout: result.stdout ?? '',
        stderr: messages.filter(Boolean).join('\n'),
        end: selectProcessEnd(stop, { isMissing, isErrored }),
        duration: Math.round(performance.now() - started),
    };
}

async function finishProcess(
    child: RunningProcess,
    supervision: ProcessTreeControl,
    started: number,
    completion: PromiseLike<SpawnCompletion>,
): Promise<SpawnResult> {
    let processFailure: unknown;
    try {
        const result = await completion;
        if (result.failed) processFailure = new Error(result.shortMessage);
        return buildSpawnResult(result, started, supervision.state);
    } catch (error) {
        processFailure = error;
        supervision.stop();
        const result = await child;
        if (result.code === 'ENOENT') return buildSpawnResult(result, started, supervision.state);
        throw error;
    } finally {
        await supervision.release(processFailure);
    }
}

async function readProcessOutput(
    child: RunningProcess,
    options: CancelableSpawnOptions,
    readStdout: StdoutReader,
): Promise<SpawnCompletion> {
    await readStdout({
        [Symbol.asyncIterator]: async function* () {
            yield* child.stdout;
            options.cancelSignal?.throwIfAborted();
        },
    });
    return child;
}

function findMissingExecutable(
    command: readonly string[],
    options: SpawnOptions,
    started: number,
): SpawnResult | undefined {
    const executable = command[0];
    if (executable === undefined) throw new Error(EMPTY_COMMAND_MESSAGE);
    if (isExecutableFilePresent(executable, options.cwd) && findProgramCommand(command, options.env) !== undefined)
        return undefined;
    return buildSpawnResult(
        {
            ...UNSTARTED_COMPLETION,
            code: 'ENOENT',
            shortMessage: `Executable not found: ${executable}`,
        },
        started,
        UNSTOPPED,
    );
}

function findUnstartedProcess(
    command: readonly string[],
    options: CancelableSpawnOptions,
    started: number,
): SpawnResult | undefined {
    const missing = findMissingExecutable(command, options, started);
    if (missing !== undefined || options.cancelSignal?.aborted !== true) return missing;
    return buildSpawnResult(
        { ...UNSTARTED_COMPLETION, code: undefined, shortMessage: CANCELED_START_MESSAGE },
        started,
        { ...UNSTOPPED, canceled: true },
    );
}

function spawnProcess(command: readonly string[], options: CancelableSpawnOptions, output: Pick<Options, 'buffer'>) {
    const [executable, ...commandArguments] = findProgramCommand(command, options.env) as readonly [
        string,
        ...string[],
    ];
    const child = execa(executable, commandArguments, {
        ...buildExecaOptions(options, command[0] as string),
        ...output,
        detached: process.platform !== 'win32',
    });
    const supervision = trackProcessTree(child, options);
    return { child, supervision };
}

/**
Check a process without signaling it. A permission refusal still means that the process exists.

@param pid the process that owns a copy.
*/
export function isProcessRunning(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        if (hasErrorCode(error, 'ESRCH')) return false;
        if (hasErrorCode(error, 'EPERM')) return true;
        throw error;
    }
}

/**
Run a supervised process tree and capture its text.

@param command executable and literal arguments.
@param options where and how the process runs.
*/
export async function runProcess(command: readonly string[], options: CancelableSpawnOptions): Promise<SpawnResult> {
    const started = performance.now();
    const unstarted = findUnstartedProcess(command, options, started);
    if (unstarted !== undefined) return unstarted;
    let spawned;
    try {
        spawned = spawnProcess(command, options, {});
    } catch (error) {
        return buildSpawnResult(
            {
                ...UNSTARTED_COMPLETION,
                code: undefined,
                shortMessage: `The program cannot start: ${String(error)}`,
            },
            started,
            UNSTOPPED,
        );
    }
    return finishProcess(spawned.child, spawned.supervision, started, spawned.child);
}

/**
Run a supervised process tree and read its output bytes.

@param command executable and literal arguments.
@param options where and how the process runs.
@param readStdout reads the output bytes.
@returns an empty stdout when the callback reads it.
*/
export async function streamProcess(
    command: readonly string[],
    options: CancelableSpawnOptions,
    readStdout: StdoutReader,
): Promise<SpawnResult> {
    const started = performance.now();
    const unstarted = findUnstartedProcess(command, options, started);
    if (unstarted !== undefined) return unstarted;
    const { child, supervision } = spawnProcess(command, options, { buffer: { stdout: false } });
    return finishProcess(child, supervision, started, readProcessOutput(child, options, readStdout));
}
