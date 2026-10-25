import { join } from 'node:path';
import { Readable } from 'node:stream';
import { spyOn, expect } from 'bun:test';
import { runProgram } from '#cli/main.ts';
import type { Sandbox } from '#tests/types/sandbox.ts';
import type { RunReport } from '#cli/types/runs/run.ts';
import { readTree } from '#tests/setup/system/files.ts';
import type { FixReport } from '#cli/types/runs/fixes.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { GSPOT_ENVIRONMENT } from '#tests/config/setup/environment.ts';
import type { AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import type { FindingRow, ScopeFindingRow } from '#tests/types/reports.ts';
import type { StdinOptions, ProcessOutput } from '#tests/types/processes.ts';

export const CLI_BIN = join(REPOSITORY_ROOT, 'packages/cli/src/bin.ts');

/**
List the file, line, and rule of every finding in the report.
*/
export function listFindingRows(report: RunReport): FindingRow[] {
    return report.checks.flatMap(({ findings }) => findings.map(({ file, line, rule }) => ({ file, line, rule })));
}

/**
List the scope, file, line, and rule of every finding in the report.
*/
export function listScopeFindingRows(report: RunReport): ScopeFindingRow[] {
    return report.checks.flatMap(({ scope, findings }) =>
        findings.map(({ file, line, rule }) => ({ scope, file, line, rule })),
    );
}

/**
Run gspot in this process over a folder with color off and CI set, and capture what it writes.

@param cwd the sandbox.
@param commandArguments everything after gspot.
@param environment extra variables, restored afterwards.
@param options byte input for commands that read standard input.
@returns the exit code and both streams.
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
        spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
            stdout.push(Buffer.from(chunk).toString());
            return true;
        }),
    );
    resources.use(
        spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
            stderr.push(Buffer.from(chunk).toString());
            return true;
        }),
    );
    const variables: Record<string, string> = { ...GSPOT_ENVIRONMENT, ...environment };
    const exitCode = process.exitCode;
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
        process.exitCode = exitCode ?? 0;
    }
}

/**
Parse the JSON report of a completed check run. Keep its exit code and streams.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 240 calls in 71 files share it.
export function parseCheckReport(output: ProcessOutput): ProcessOutput & { report: RunReport & { fixes?: FixReport } } {
    return { ...output, report: JSON.parse(output.stdout) as RunReport & { fixes?: FixReport } };
}

/**
Run gspot as a child process in a folder with color off and CI set.

@param cwd the sandbox.
@param commandArguments everything after gspot.
@param environment extra variables for the child.
@param options stdin for the child process.
@returns the exit code and both streams.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 61 files call it.
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

/**
Run one check as a child process and return its result for the root scope.
*/
export async function spawnRootCheck(root: string, check: string): Promise<CheckResult> {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', check, '--json']));
    const found = result.report.checks.find((each) => each.scope === '');
    if (found === undefined) throw new Error(`The report has no root result for ${check}.`);
    return found;
}

/**
Run one gspot command in a sandbox and throw with its output when it fails.
*/
export async function runGspotStep(sandbox: Sandbox, commandArguments: readonly string[]): Promise<ProcessOutput> {
    const result = await sandbox.run(sandbox.root, commandArguments);
    if (result.code !== 0) {
        const message = `gspot ${commandArguments.join(' ')} failed in ${sandbox.root}:\n${result.stdout}${result.stderr}`;
        throw new Error(message);
    }
    return result;
}

/**
Run a refused command in text and JSON, and check that both refuse it and write nothing.

@param root the sandbox that the command must leave unchanged.
@param commandArguments the refused command.
@param refusal the error kind and the message that both outputs name.
@param refusal.error the error kind of the JSON output.
@param refusal.message the refusal text.
*/
export async function expectRefusalWithoutWrites(
    root: string,
    commandArguments: readonly string[],
    refusal: { error: string; message: string },
): Promise<void> {
    const before = await readTree(root);
    const human = await runGspot(root, commandArguments);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe(`${refusal.message}\n`);
    expect(await readTree(root)).toStrictEqual(before);
    const structured = await runGspot(root, [...commandArguments, '--json']);
    expect(structured.code).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual(refusal);
    expect(await readTree(root)).toStrictEqual(before);
}

/**
Run apply and install in a sandbox.
*/
export async function applyThenInstall(root: string): Promise<void> {
    const sandbox = { root, run: spawnGspot };
    await runGspotStep(sandbox, ['apply']);
    await runGspotStep(sandbox, ['install']);
}

/**
The init arguments for a test run without prompts.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 48 calls in 14 files share it.
export function buildInitArguments(configurations: readonly string[]): string[] {
    return ['init', '--yes', ...(configurations.length === 0 ? [] : ['--configurations', ...configurations])];
}
