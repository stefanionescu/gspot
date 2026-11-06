import { join } from 'node:path';
import { Readable } from 'node:stream';
import { parseArgs } from 'node:util';

import { parse } from '@decimalturn/toml-patch';
import { expect } from 'bun:test';
import type { z } from 'zod';

import { planInit } from '#cli/generation/setup/planner.ts';
import { runProgram } from '#cli/main.ts';
import { runReportSchema } from '#cli/schemas/engine.ts';
import type { CheckResult, RunReport } from '#cli/types/engine/run.ts';
import type { InitPlanning } from '#cli/types/generation.ts';
import type { Level, TomlTable } from '#cli/types/settings.ts';
import type { CancelableSpawnOptions, CommandFailureJson, ErrorCode } from '#cli/types/system.ts';
import { GSPOT_ENVIRONMENT } from '#tests/config/setup/programs.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { captureTerminal } from '#tests/setup/system/terminal.ts';
import type { FindingRow, ProcessOutput, Sandbox, StdinOptions } from '#tests/types/setup.ts';

export const CLI_BIN = join(REPOSITORY_ROOT, 'packages/cli/src/bin.ts');

export function listFindingRows(report: RunReport): FindingRow[] {
    return report.checks.flatMap(({ findings }) => findings.map(({ file, line, rule }) => ({ file, line, rule })));
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

export async function runInit(
    root: string,
    commandArguments: readonly string[] = [],
): Promise<Pick<InitPlanning, 'plan'> & { settings: TomlTable }> {
    commitAll(root);
    const { values } = parseArgs({
        args: [...commandArguments],
        options: { configurations: { type: 'string', multiple: true }, level: { type: 'string' } },
    });
    const { plan, settingsText } = await planInit(root, {
        cwd: root,
        configurations: values.configurations,
        level: values.level as Level | undefined,
    });
    return { plan, settings: parse(settingsText) as TomlTable };
}

export function parseCheckReport(output: ProcessOutput): ProcessOutput & { report: z.infer<typeof runReportSchema> } {
    return { ...output, report: runReportSchema.parse(JSON.parse(output.stdout)) };
}

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

export async function readSuppressionResults(
    root: string,
    paths: readonly string[],
    reported: ReadonlySet<string>,
): Promise<Array<{ path: string; suppressed: boolean; directives: Array<Pick<FindingRow, 'line' | 'rule'>> }>> {
    const { report } = parseCheckReport(await spawnGspot(root, ['check', '--only', 'gspot/suppressions', '--json']));
    const findings = report.checks.flatMap((check) => check.findings);
    return paths.map((path) => ({
        path,
        suppressed: !reported.has(path),
        directives: findings.filter((finding) => finding.file === path).map(({ line, rule }) => ({ line, rule })),
    }));
}

export async function runGspotStep(sandbox: Sandbox, commandArguments: readonly string[]): Promise<ProcessOutput> {
    const result = await sandbox.run(sandbox.root, commandArguments);
    if (result.code !== 0) {
        const message = `gspot ${commandArguments.join(' ')} failed in ${sandbox.root}:\n${result.stdout}${result.stderr}`;
        throw new Error(message);
    }
    return result;
}

export async function assertRefusalWithoutWrites(
    root: string,
    commandArguments: readonly string[],
    error: ErrorCode,
): Promise<CommandFailureJson> {
    const before = await readTree(root);
    const structured = await runGspot(root, [...commandArguments, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    const failure = JSON.parse(structured.stdout) as CommandFailureJson;
    expect(failure).toMatchObject({ error });
    expect(await readTree(root)).toStrictEqual(before);
    return failure;
}
