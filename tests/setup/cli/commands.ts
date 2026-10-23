// Runs gspot in a sandbox, in this process or as a child process, and reads its JSON report.
import { spyOn } from 'bun:test';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { runProgram } from '#cli/main.ts';
import type { Sandbox } from '#tests/types/sandbox.ts';
import type { RunReport } from '#cli/types/runs/run.ts';
import type { FixReport } from '#cli/types/runs/fixes.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { GSPOT_ENVIRONMENT } from '#tests/config/setup/environment.ts';
import type { AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import type { StdinOptions, ProcessOutput } from '#tests/types/processes.ts';
import type { FindingRow, ScopeFindingRow } from '#tests/types/tool-output.ts';

/** The gspot source folder in this checkout. */
export const CLI_SOURCE_PATH = join(import.meta.dir, '../../../packages/cli/src');

/** The CLI entry file in this checkout. */
export const CLI_MAIN = join(CLI_SOURCE_PATH, 'main.ts');

/** The shipped CLI entry file, including its runtime check. */
export const CLI_BIN = join(CLI_SOURCE_PATH, 'bin.ts');

/** List the file, line, and rule of every finding in the report. */
export function listFindingRows(report: RunReport): FindingRow[] {
    return report.checks.flatMap(({ findings }) => findings.map(({ file, line, rule }) => ({ file, line, rule })));
}

/** List the scope, file, line, and rule of every finding in the report. */
export function listScopeFindingRows(report: RunReport): ScopeFindingRow[] {
    return report.checks.flatMap(({ scope, findings }) =>
        findings.map(({ file, line, rule }) => ({ scope, file, line, rule })),
    );
}

/**
 * Run gspot in this process over a folder with color off and CI set, and capture what it writes.
 *
 * @param cwd the sandbox.
 * @param commandArguments everything after gspot.
 * @param environment extra variables, restored afterwards.
 * @param options byte input for commands that read standard input.
 * @returns the exit code and both streams.
 */
export async function runGspot(
    cwd: string,
    commandArguments: readonly string[],
    environment: Record<string, string> = {},
    options: StdinOptions = {},
): Promise<ProcessOutput> {
    const previousFolder = process.cwd();
    const stdout: string[] = [];
    const stderr: string[] = [];
    using resources = new DisposableStack();
    resources.use(
        spyOn(process.stdout, 'write').mockImplementation(
            (chunk: string | Uint8Array) => stdout.push(Buffer.from(chunk).toString()) > 0,
        ),
    );
    resources.use(
        spyOn(process.stderr, 'write').mockImplementation(
            (chunk: string | Uint8Array) => stderr.push(Buffer.from(chunk).toString()) > 0,
        ),
    );
    const variables: Record<string, string> = { ...GSPOT_ENVIRONMENT, ...environment };
    const exitCode = process.exitCode;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Node defines process.stdin on the process object.
    const stdin = Object.getOwnPropertyDescriptor(process, 'stdin')!;
    using _environment = overrideEnvironment(variables);
    process.exitCode = 0;
    try {
        if (options.stdin !== undefined)
            Object.defineProperty(process, 'stdin', {
                value: Readable.from([Buffer.from(options.stdin)]),
                configurable: true,
            });
        process.chdir(cwd);
        const code = await runProgram([...commandArguments]);
        return { code, stdout: stdout.join(''), stderr: stderr.join('') };
    } finally {
        process.chdir(previousFolder);
        Object.defineProperty(process, 'stdin', stdin);
        // Assigning undefined keeps the last Bun exit code; restore an unset code as 0.
        process.exitCode = exitCode ?? 0;
    }
}

/** Parse the JSON report of a completed check run. Keep its exit code and streams. */
export function parseCheckReport(output: ProcessOutput): ProcessOutput & { report: RunReport & { fixes?: FixReport } } {
    return { ...output, report: JSON.parse(output.stdout) as RunReport & { fixes?: FixReport } };
}

/**
 * Run gspot as a child process in a folder with color off and CI set.
 *
 * @param cwd the sandbox.
 * @param commandArguments everything after gspot.
 * @param environment extra variables for the child.
 * @param options stdin for the child process.
 * @returns the exit code and both streams.
 */
export async function spawnGspot(
    cwd: string,
    commandArguments: readonly string[],
    environment: Record<string, string> = {},
    options: Pick<AsyncSpawnOptions, 'stdin'> = {},
): Promise<ProcessOutput> {
    return await runCommand([process.execPath, CLI_BIN, ...commandArguments], {
        cwd,
        env: { ...GSPOT_ENVIRONMENT, ...environment },
        ...options,
    });
}

/** Run one check as a child process and return its result for the root scope. */
export async function spawnRootCheck(root: string, check: string): Promise<CheckResult> {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', check, '--json']));
    const found = result.report.checks.find((each) => each.scope === '');
    if (found === undefined) throw new Error(`The report has no root result for ${check}.`);
    return found;
}

/** Run one gspot command in a sandbox and throw with its output when it fails. */
export async function runGspotStep(sandbox: Sandbox, commandArguments: readonly string[]): Promise<ProcessOutput> {
    const result = await sandbox.run(sandbox.root, commandArguments, sandbox.environment);
    if (result.code !== 0) {
        const message = `gspot ${commandArguments.join(' ')} failed in ${sandbox.root}:\n${result.stdout}${result.stderr}`;
        throw new Error(message);
    }
    return result;
}

/** Run apply and install in a sandbox. */
export async function installGeneratedTools(root: string): Promise<void> {
    const sandbox = { root, environment: {}, run: spawnGspot };
    await runGspotStep(sandbox, ['apply']);
    await runGspotStep(sandbox, ['install']);
}

/** The init arguments for a test run without prompts. */
export function buildInitArguments(configurations: readonly string[], options: { json?: boolean } = {}): string[] {
    return [
        'init',
        '--yes',
        ...(configurations.length === 0 ? [] : ['--configurations', ...configurations]),
        ...(options.json === true ? ['--json'] : []),
    ];
}
