import { statSync } from 'node:fs';
import { execa, type Options } from 'execa';
import { hasErrorCode } from '#cli/system/errors.ts';
import { selectProgram } from '#cli/system/programs.ts';
import { trackProcessTree } from '#cli/system/process-trees.ts';
import { dirname, resolve, delimiter, isAbsolute } from 'node:path';
import { foldVariableName, buildSpawnEnvironment, readEnvironmentVariable } from '#cli/system/environment.ts';

import type {
    SpawnResult,
    SpawnOptions,
    StdoutReader,
    RunningProcess,
    SpawnCompletion,
    AsyncSpawnOptions,
    ProcessTreeControl,
} from '#cli/types/system.ts';
import {
    FAILED_CODE,
    OUTPUT_LIMIT,
    MISSING_CODE,
    PATHEXT_DEFAULT,
    PATH_SEPARATORS,
    EMPTY_COMMAND_MESSAGE,
    CANCELED_START_MESSAGE,
} from '#cli/config/system.ts';

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

function isExecutableAbsent(executable: string, cwd: string): boolean {
    if (!PATH_SEPARATORS.test(executable)) return false;
    const path = resolve(cwd, executable);
    const extensions =
        process.platform === 'win32' ? (readEnvironmentVariable('PATHEXT') ?? PATHEXT_DEFAULT).split(';') : [];
    return [path, ...extensions.map((extension) => path + extension.toLowerCase())].every(
        (executablePath) => statSync(executablePath, { throwIfNoEntry: false }) === undefined,
    );
}

function buildSpawnResult(result: SpawnCompletion, started: number): SpawnResult {
    const isMissing = result.code === 'ENOENT';
    const isUnfinishedResult = [
        result.exitCode === undefined,
        result.code !== undefined,
        result.cause !== undefined,
    ].includes(true);
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
        return { ...buildSpawnResult(result, started), ...supervision.state };
    } catch (error) {
        processFailure = error;
        supervision.stop();
        const result = await child;
        if (result.code === 'ENOENT') return { ...buildSpawnResult(result, started), ...supervision.state };
        throw error;
    } finally {
        await supervision.release(processFailure);
    }
}

async function readProcessOutput(
    child: RunningProcess,
    options: AsyncSpawnOptions,
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
    if (!isExecutableAbsent(executable, options.cwd) && selectProgram(command, options.env) !== undefined)
        return undefined;
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

function findUnstartedProcess(
    command: readonly string[],
    options: AsyncSpawnOptions,
    started: number,
): SpawnResult | undefined {
    const missing = findMissingExecutable(command, options, started);
    if (missing !== undefined || options.cancelSignal?.aborted !== true) return missing;
    return buildSpawnResult(
        {
            code: undefined,
            failed: true,
            shortMessage: CANCELED_START_MESSAGE,
            stdout: '',
            stderr: '',
            timedOut: false,
            isCanceled: true,
        } satisfies SpawnCompletion,
        started,
    );
}

function launchProcess(command: readonly string[], options: AsyncSpawnOptions, output: Pick<Options, 'buffer'>) {
    const [executable, ...commandArguments] = selectProgram(command, options.env) as readonly [string, ...string[]];
    const child = execa(executable, commandArguments, {
        ...buildExecaOptions(options, command[0] as string),
        ...output,
        detached: process.platform !== 'win32',
    });
    const supervision = trackProcessTree(child, options);
    return { child, supervision };
}

/**
Run a supervised process tree and capture its text.

@param command executable and literal arguments.
@param options where and how the process runs.
*/
export async function spawnProcess(command: readonly string[], options: AsyncSpawnOptions): Promise<SpawnResult> {
    const started = performance.now();
    const unstarted = findUnstartedProcess(command, options, started);
    if (unstarted !== undefined) return unstarted;
    const { child, supervision } = launchProcess(command, options, {});
    return finishProcess(child, supervision, started, child);
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
    options: AsyncSpawnOptions,
    readStdout: StdoutReader,
): Promise<SpawnResult> {
    const started = performance.now();
    const unstarted = findUnstartedProcess(command, options, started);
    if (unstarted !== undefined) return unstarted;
    const { child, supervision } = launchProcess(command, options, { buffer: { stdout: false } });
    return finishProcess(child, supervision, started, readProcessOutput(child, options, readStdout));
}
