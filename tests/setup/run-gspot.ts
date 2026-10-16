// Runs gspot in a sandbox and captures its exit code and output.
import { spyOn } from 'bun:test';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { main } from '#cli/commands/program.ts';
import { gitOutput } from '#tests/setup/git.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { useEnvironment } from '#tests/setup/environment.ts';
import type { FindingRow } from '#tests/types/tool-output.ts';
import { GSPOT_ENVIRONMENT } from '#tests/config/processes.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/implementations.ts';
import type { AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import type { RunReport, RunOptions } from '#cli/types/execution/check.ts';
import type { StdinOptions, SpawnOutcome } from '#tests/types/processes.ts';

/** The gspot source folder in this checkout. */
export const CLI_SOURCE = join(import.meta.dir, '../../packages/cli/src');

export function findingRows(report: RunReport): FindingRow[] {
    return report.checks.flatMap(({ findings }) => findings.map(({ file, line, rule }) => ({ file, line, rule })));
}

/** Resolve the source executable once for this checkout's test processes. */
export const CLI_MAIN = join(CLI_SOURCE, 'main.ts');

/**
 * Runs gspot in this process over a directory with color off and CI set, capturing what it writes.
 * @param cwd the sandbox.
 * @param argv the command line after gspot.
 * @param environment verbatim variables, restored afterwards.
 * @param options byte input for commands that read standard input.
 * @returns the exit code and both streams.
 */
export async function runGspot(
    cwd: string,
    argv: readonly string[],
    environment: Record<string, string> = {},
    options: StdinOptions = {},
): Promise<SpawnOutcome> {
    const previousDirectory = process.cwd();
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
    using _environment = useEnvironment(variables);
    process.exitCode = 0;
    try {
        if (options.stdin !== undefined)
            Object.defineProperty(process, 'stdin', {
                value: Readable.from([Buffer.from(options.stdin)]),
                configurable: true,
            });
        process.chdir(cwd);
        const code = await main([...argv]);
        return { code, stdout: stdout.join(''), stderr: stderr.join('') };
    } finally {
        process.chdir(previousDirectory);
        Object.defineProperty(process, 'stdin', stdin);
        // Assigning undefined keeps the last Bun exit code; restore an unset code as 0.
        process.exitCode = exitCode ?? 0;
    }
}

/**
 * Runs the ordinary pre-push hook for the selected revision and its remote base.
 * @param root the repository.
 * @param base the remote revision.
 * @param head the pushed revision.
 * @param checks the check names selected for this hook run.
 * @returns the hook exit code and output.
 */
export async function runPrePush(
    root: string,
    base: string,
    head: string,
    checks: readonly string[],
): Promise<SpawnOutcome> {
    gitOutput(root, ['update-ref', 'refs/remotes/origin/main', base]);
    return await runGspot(
        root,
        ['check', '--hook', 'pre-push', '--only', ...checks, '--json', '--', 'origin'],
        {},
        {
            stdin: `refs/heads/main ${head} refs/heads/main ${base}\n`,
        },
    );
}

/**
 * Capture a JSON check report while retaining the command's exit code and both streams.
 * @param cwd the sandbox.
 * @param argv the test's complete check command, including JSON output.
 * @param environment the command's environment.
 * @param options byte input for hook commands.
 * @returns the command evidence and its parsed report.
 */
export async function checkReport(
    cwd: string,
    argv: readonly string[],
    environment: Record<string, string> = {},
    options: StdinOptions = {},
): Promise<SpawnOutcome & { report: RunReport }> {
    const result = await runGspot(cwd, argv, environment, options);
    return { ...result, report: JSON.parse(result.stdout) as RunReport };
}

/**
 * Runs gspot as a child process in a directory with color off and CI set, through the product's child process.
 * @param cwd the sandbox.
 * @param argv the command line after gspot.
 * @param environment verbatim variables.
 * @param options stdin for the child process.
 * @returns the exit code and both streams.
 */

export async function spawnGspot(
    cwd: string,
    argv: readonly string[],
    environment: Record<string, string> = {},
    options: Pick<AsyncSpawnOptions, 'stdin'> = {},
): Promise<SpawnOutcome> {
    return await runCommand([process.execPath, CLI_MAIN, ...argv], {
        cwd,
        env: { ...GSPOT_ENVIRONMENT, ...environment },
        ...options,
    });
}

/**
 * The options of an in-process run: every stage, the built-in checks, nothing skipped, no fixes, and a real run.
 * @param overrides the options a test changes, such as the checks it runs with only.
 * @returns the run options.
 */

export function buildRunOptions(overrides: Partial<RunOptions> = {}): RunOptions {
    return { checks: BUILT_IN_CHECKS, stage: 'all', fix: false, isDryRun: false, ...overrides };
}
