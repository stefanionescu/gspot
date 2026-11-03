import { join } from 'node:path';
import { expect } from 'bun:test';
import { Readable } from 'node:stream';
import { runProgram } from '#cli/main.ts';
import { parse } from '@decimalturn/toml-patch';
import { commitAll } from '#tests/setup/system/git.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import { readTree } from '#tests/setup/system/files.ts';
import type { InitJson } from '#cli/types/commands/edits.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { captureTerminal } from '#tests/setup/system/terminal.ts';
import type { CancelableSpawnOptions } from '#cli/types/system.ts';
import { GSPOT_ENVIRONMENT } from '#tests/config/setup/programs.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import type { RunReport, FixReport, CheckResult } from '#cli/types/engine/run.ts';
import type { Sandbox, FindingRow, StdinOptions, ProcessOutput, ScopeFindingRow } from '#tests/types/setup.ts';

export const CLI_BIN = join(REPOSITORY_ROOT, 'packages/cli/src/bin.ts');

export function listFindingRows(report: RunReport): FindingRow[] {
    return report.checks.flatMap(({ findings }) => findings.map(({ file, line, rule }) => ({ file, line, rule })));
}

export function listScopeFindingRows(report: RunReport): ScopeFindingRow[] {
    return report.checks.flatMap(({ scope, findings }) =>
        findings.map(({ file, line, rule }) => ({ scope, file, line, rule })),
    );
}

/**
Run gspot in this process over a folder with color off and CI set, and capture what it writes. The command gets the
folder as an argument, so the process folder stays as it is. It restores the environment variables it sets.
*/
export async function runGspot(
    cwd: string,
    commandArguments: readonly string[],
    environment: Record<string, string> = {},
    options: StdinOptions = {},
): Promise<ProcessOutput> {
    using output = captureTerminal();
    const { stdout, stderr } = output;
    const variables: Record<string, string> = { ...GSPOT_ENVIRONMENT, ...environment };
    const stdin = Object.getOwnPropertyDescriptor(process, 'stdin')!;
    using _environment = overrideEnvironment(variables);
    try {
        if (options.stdin !== undefined)
            Object.defineProperty(process, 'stdin', {
                value: Readable.from([Buffer.from(options.stdin)]),
                configurable: true,
            });
        const code = await runProgram([...commandArguments], cwd);
        return { code, stdout: stdout.join(''), stderr: stderr.join('') };
    } finally {
        Object.defineProperty(process, 'stdin', stdin);
    }
}

/**
Commit a folder and run init on it with --json. The result holds the plan and the settings that init writes.
*/
export async function runInit(
    root: string,
    commandArguments: readonly string[] = [],
): Promise<Required<Pick<InitJson, 'plan'>> & { settings: TomlTable }> {
    commitAll(root);
    const result = await runGspot(root, ['init', '--json', ...commandArguments]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan, settingsText } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan' | 'settingsText'>>;
    return { plan, settings: parse(settingsText) as TomlTable };
}

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
    options: Pick<CancelableSpawnOptions, 'stdin'> = {},
): Promise<ProcessOutput> {
    return await runCommand([process.execPath, CLI_BIN, ...commandArguments], {
        cwd,
        env: { ...GSPOT_ENVIRONMENT, ...environment },
        ...options,
    });
}

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

export async function applyThenInstall(root: string): Promise<void> {
    const sandbox = { root, run: spawnGspot };
    await runGspotStep(sandbox, ['apply']);
    await runGspotStep(sandbox, ['install']);
}
