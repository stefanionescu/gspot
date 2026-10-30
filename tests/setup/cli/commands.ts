import { join } from 'node:path';
import { Readable } from 'node:stream';
import { spyOn, expect } from 'bun:test';
import { runProgram } from '#cli/main.ts';
import { type Sandbox } from '#tests/types/sandbox.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { type AsyncSpawnOptions } from '#cli/types/system/system.ts';
import { GSPOT_ENVIRONMENT } from '#tests/config/setup/environment.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { type RunReport, type FixReport } from '#cli/types/commands/check.ts';
import { type FindingRow, type ScopeFindingRow } from '#tests/types/reports.ts';
import { type StdinOptions, type ProcessOutput } from '#tests/types/processes.ts';

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
Run gspot in this process over a folder with color off and CI set, and capture what it writes. It restores the
environment variables it sets.
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
    const stdin = Object.getOwnPropertyDescriptor(process, 'stdin')!;
    using _environment = overrideEnvironment(variables);
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
    }
}

/**
Parse the JSON report of a completed check run.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: This reader keeps the parsed report cast at one boundary.
export function parseCheckReport(output: ProcessOutput): ProcessOutput & { report: RunReport & { fixes?: FixReport } } {
    return { ...output, report: JSON.parse(output.stdout) as RunReport & { fixes?: FixReport } };
}

/**
Run gspot as a child process in a folder with color off and CI set.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Sandbox.run takes it as a value.
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
export async function spawnRootCheck(root: string, checkId: string): Promise<CheckResult> {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', checkId, '--json']));
    const found = result.report.checks.find((each) => each.scope === '');
    if (found === undefined) throw new Error(`The report has no root result for ${checkId}.`);
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
Run a refused command with --json, and check that it refuses it with the error kind and message of the refusal, and
writes nothing.
*/
export async function assertRefusalWithoutWrites(
    root: string,
    commandArguments: readonly string[],
    refusal: { error: string; message: string },
): Promise<void> {
    const before = await readTree(root);
    const structured = await runGspot(root, [...commandArguments, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(JSON.parse(structured.stdout)).toMatchObject(refusal);
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
