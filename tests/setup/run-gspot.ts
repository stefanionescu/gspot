// Runs gspot in a sandbox and captures its exit code and output.
import { spyOn } from 'bun:test';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { runCommand } from '#tests/setup/processes.ts';
import { runProgram, buildProgram } from '#cli/main.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { GSPOT_ENVIRONMENT } from '#tests/data/test-setup.ts';
import type { FindingRow } from '#tests/types/tool-output.ts';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import type { AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import type { StdinOptions, ProcessOutput } from '#tests/types/processes.ts';
import type { Finding, RunReport, CheckResult } from '#cli/types/runs/check.ts';

/** The gspot source folder in this checkout. */
export const CLI_SOURCE_PATH = join(import.meta.dir, '../../packages/cli/src');

export function listFindingRows(report: RunReport): FindingRow[] {
    return report.checks.flatMap(({ findings }) => findings.map(({ file, line, rule }) => ({ file, line, rule })));
}

/** The CLI entry file in this checkout. */
export const CLI_MAIN = join(CLI_SOURCE_PATH, 'main.ts');

/**
 * Run a command through the CLI program and return its result before any terminal output.
 *
 * @param cwd the sandbox in which the command starts.
 * @param commandArguments everything after gspot.
 * @returns the command result.
 * @throws the argument or command error when parsing or execution fails.
 */
export async function runRegisteredCommand(cwd: string, commandArguments: readonly string[]): Promise<CommandResult> {
    let result!: CommandResult;
    const program = buildProgram((value) => {
        result = value;
    });
    const previousFolder = process.cwd();
    try {
        process.chdir(cwd);
        await program.parseAsync([...commandArguments], { from: 'user' });
        return result;
    } finally {
        process.chdir(previousFolder);
    }
}

/**
 * Runs gspot in this process over a folder with color off and CI set, capturing what it writes.
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

/**
 * Run a check in this process and parse its JSON report. The result keeps the exit code and both streams.
 *
 * @param cwd the sandbox.
 * @param commandArguments a full check call, with --json.
 * @param environment extra variables.
 * @returns the process output and its parsed report.
 */
export async function checkReport(
    cwd: string,
    commandArguments: readonly string[],
    environment: Record<string, string> = {},
): Promise<ProcessOutput & { report: RunReport }> {
    const result = await runGspot(cwd, commandArguments, environment);
    return { ...result, report: JSON.parse(result.stdout) as RunReport };
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
    return await runCommand([process.execPath, CLI_MAIN, ...commandArguments], {
        cwd,
        env: { ...GSPOT_ENVIRONMENT, ...environment },
        ...options,
    });
}

/** Run a check command as a child process and parse its JSON report. */
export async function spawnCheckReport(
    cwd: string,
    commandArguments: readonly string[],
    environment: Record<string, string> = {},
): Promise<ProcessOutput & { report: RunReport }> {
    const result = await spawnGspot(cwd, commandArguments, environment);
    return { ...result, report: JSON.parse(result.stdout) as RunReport };
}

/** Run one check as a child process and return its result for the root scope. */
export async function spawnRootCheck(root: string, check: string): Promise<CheckResult> {
    const result = await spawnCheckReport(root, ['check', '--only', check, '--json']);
    return result.report.checks.find((entry) => entry.scope === '') as CheckResult;
}

/** Run a check command as a child process and collect the findings of every scope. */
export async function spawnCheckFindings(
    root: string,
    commandArguments: readonly string[],
    environment: Record<string, string>,
): Promise<ProcessOutput & { findings: Finding[] }> {
    const result = await spawnCheckReport(root, commandArguments, environment);
    return { ...result, findings: result.report.checks.flatMap((check) => check.findings) };
}
