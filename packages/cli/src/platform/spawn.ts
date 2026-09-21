// Execa owns subprocess capture, deadlines, cancellation, and platform command shims.
import { execa, execaSync, type Result } from 'execa';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { AsyncSpawnOptions, SpawnResult, SpawnOptions, BinarySpawnResult } from '#types/platform.ts';

const MISSING_CODE = 127;
const FAILED_CODE = 1;
const REPORT_DESCRIPTOR = 3;

function commandOptions(options: SpawnOptions) {
    return {
        cwd: options.cwd,
        env: { ...environmentVariables(), ...options.env },
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
    const failure = result.exitCode === undefined && result.failed ? result.shortMessage : undefined;
    const stderr = failure === undefined ? diagnostic : [diagnostic, failure].filter(Boolean).join('\n');
    return {
        code: missing ? MISSING_CODE : (result.exitCode ?? FAILED_CODE),
        stdout: result.stdout,
        stderr,
        missing,
        duration: performance.now() - started,
        isTimedOut: result.timedOut,
        isCanceled: result.isCanceled,
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
    const base = commandOptions(options);
    const child = execa(executable, argv, {
        ...base,
        stdio: [...base.stdio, ...(options.captureFd3 === true ? ['pipe' as const] : [])],
        ...(options.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal }),
    });
    // A capture failure leaves no usable report; cancel the child instead of waiting for its deadline.
    for (const stream of child.stdio) stream?.once('error', () => child.kill('SIGKILL'));
    const result = await child;
    return {
        ...completed(result, started),
        ...(options.captureFd3 === true ? { fd3: result.stdio.at(REPORT_DESCRIPTOR) ?? '' } : {}),
    };
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
    return completed(execaSync(executable, argv, commandOptions(options)), started);
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
export async function runBinary(
    command: string[],
    options: Omit<AsyncSpawnOptions, 'captureFd3'>,
): Promise<BinarySpawnResult> {
    const started = performance.now();
    const [executable, ...argv] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    const child = execa(executable, argv, {
        ...commandOptions(options),
        // Bun requires a Node encoding name when it constructs child-process streams.
        encoding: 'base64',
        ...(options.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal }),
    });
    // A capture failure must also terminate Git processes that produce binary objects.
    for (const stream of child.stdio) stream?.once('error', () => child.kill('SIGKILL'));
    const result = await child;
    return {
        ...completed(result, started, Buffer.from(result.stderr, 'base64').toString('utf8')),
        stdout: Buffer.from(result.stdout, 'base64'),
    };
}
