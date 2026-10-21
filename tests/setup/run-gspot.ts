// Runs gspot in a sandbox and captures its exit code and output.
import { spyOn } from 'bun:test';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { runProgram } from '#cli/main.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { GSPOT_ENVIRONMENT } from '#tests/data/test-setup.ts';
import type { FindingRow } from '#tests/types/tool-output.ts';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import type { AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import type { StdinOptions, ProcessOutput } from '#tests/types/processes.ts';
import type { FixReport, RunReport, CheckResult } from '#cli/types/runs/check.ts';

/** The gspot source folder in this checkout. */
export const CLI_SOURCE_PATH = join(import.meta.dir, '../../packages/cli/src');

export function listFindingRows(report: RunReport): FindingRow[] {
    return report.checks.flatMap(({ findings }) => findings.map(({ file, line, rule }) => ({ file, line, rule })));
}

/** The CLI entry file in this checkout. */
export const CLI_MAIN = join(CLI_SOURCE_PATH, 'main.ts');

/** The shipped CLI entry file, including its runtime check. */
export const CLI_BIN = join(CLI_SOURCE_PATH, 'bin.ts');

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
    return result.report.checks.find((entry) => entry.scope === '') as CheckResult;
}
