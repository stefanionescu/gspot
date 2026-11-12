import { closeSync, createWriteStream, mkdtempSync, openSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import { clearInterval, setInterval } from 'node:timers';

import { execa } from 'execa';

import {
    CANCELED_START_MESSAGE,
    EMPTY_COMMAND_MESSAGE,
    FAILED_CODE,
    MISSING_CODE,
    OUTPUT_LIMIT,
    OUTPUT_POLL_MILLISECONDS,
    OVER_LIMIT_COMPLETION,
    PATH_SEPARATORS,
    PATHEXT_DEFAULT,
    TEMPORARY_FILE_PREFIX,
    TEMPORARY_REMOVAL_OPTIONS,
    UNSTARTED_COMPLETION,
    UNSTOPPED,
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
        stdin: options.stdin === undefined ? ('ignore' as const) : ('pipe' as const),
        encoding: 'utf8' as const,
        buffer: true,
        stripFinalNewline: false,
        reject: false,
        maxBuffer: OUTPUT_LIMIT,
        detached: process.platform !== 'win32',
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
    child: PromiseLike<SpawnCompletion>,
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

function findExecaCommand(command: readonly string[], options: SpawnOptions) {
    const [executable, ...commandArguments] = findProgramCommand(command, options.env) as readonly [
        string,
        ...string[],
    ];
    return { executable, commandArguments, base: buildExecaOptions(options, command[0] as string) };
}

/**
Wait for a process whose output goes to two files, and read them. A process that passes the output limit stops and
fails, as it does when gspot buffers a pipe.
*/
async function readOutputFiles(
    child: PromiseLike<SpawnCompletion>,
    supervision: ProcessTreeControl,
    paths: readonly [string, string],
): Promise<SpawnCompletion> {
    const isOverLimit = () => paths.some((path) => statSync(path).size > OUTPUT_LIMIT);
    const timer = setInterval(() => {
        if (isOverLimit()) supervision.stop();
    }, OUTPUT_POLL_MILLISECONDS);
    try {
        const result = await child;
        if (isOverLimit()) return { ...result, ...OVER_LIMIT_COMPLETION };
        const [stdout, stderr] = paths.map((path) => readFileSync(path, 'utf8')) as [string, string];
        return { ...result, stdout, stderr };
    } finally {
        clearInterval(timer);
    }
}

/**
Check a process without signaling it. A permission refusal still means that the process exists.
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
Run a command and return its whole output. The command writes to two files, not to pipes, because Node.js and Bun
drop the output that a pipe has not yet taken when a program calls `process.exit`.
*/
export async function runProcess(command: readonly string[], options: CancelableSpawnOptions): Promise<SpawnResult> {
    const started = performance.now();
    const unstarted = findUnstartedProcess(command, options, started);
    if (unstarted !== undefined) return unstarted;
    const folder = mkdtempSync(join(tmpdir(), TEMPORARY_FILE_PREFIX));
    const paths = [join(folder, 'stdout'), join(folder, 'stderr')] as const;
    const descriptors = paths.map((path) => openSync(path, 'a'));
    try {
        let child;
        try {
            // The child takes the descriptor of each stream, so it writes to the file itself.
            const [stdout, stderr] = descriptors.map((fd) => createWriteStream('', { fd, autoClose: false }));
            const { executable, commandArguments, base } = findExecaCommand(command, options);
            child = execa(executable, commandArguments, { ...base, stdout, stderr });
        } catch (error) {
            // Under Bun, execa throws for a file that the system cannot execute, such as an empty one, where Node.js
            // returns the failure.
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
        const supervision = trackProcessTree(child, options);
        return await finishProcess(child, supervision, started, readOutputFiles(child, supervision, paths));
    } finally {
        for (const descriptor of descriptors) closeSync(descriptor);
        rmSync(folder, TEMPORARY_REMOVAL_OPTIONS);
    }
}

export async function streamProcess(
    command: readonly string[],
    options: CancelableSpawnOptions,
    readStdout: StdoutReader,
): Promise<SpawnResult> {
    const started = performance.now();
    const unstarted = findUnstartedProcess(command, options, started);
    if (unstarted !== undefined) return unstarted;
    const { executable, commandArguments, base } = findExecaCommand(command, options);
    const child = execa(executable, commandArguments, {
        ...base,
        stdout: 'pipe',
        stderr: 'pipe',
        buffer: { stdout: false },
    });
    const supervision = trackProcessTree(child, options);
    return finishProcess(child, supervision, started, readProcessOutput(child, options, readStdout));
}
