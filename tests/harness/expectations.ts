// Shared assertions preserve exact check outcomes; test files own every registration.
import { expect } from 'bun:test';
import { join, relative } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { realpathSync, writeFileSync } from 'node:fs';
import { runTestCommand } from '#tests/harness/command.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { PackageCheckCase } from '#tests/types/packages/check-case.ts';
import { runCheckCase, buildCorrection } from '#tests/harness/check-case.ts';
import type { Consumer, ConsumerOptions } from '#tests/types/harness/consumer.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';

/**
 * Awaits a promise that must reject with an error.
 * @param promise the promise expected to reject
 * @returns the message of the error it rejected with
 */
export async function rejection(promise: Promise<unknown>): Promise<string> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof Error) return error.message;
        throw new Error(`The promise rejected with a value that is not an error: ${String(error)}`);
    }
    throw new Error('The promise resolved, and a rejection was expected.');
}

/**
 * An object that must hold these properties, typed as the compared value.
 * @param shape the properties the compared object must hold
 * @returns the matcher
 */

export function containing<T>(shape: NoInfer<Partial<T>>): T {
    return expect.objectContaining(shape) as T;
}

/**
 * An array that must hold these items, typed as the compared value.
 * @param items the items the compared array must hold
 * @returns the matcher
 */

export function containingAll<T>(items: NoInfer<T[]>): T[] {
    return expect.arrayContaining(items) as T[];
}

/**
 * Text that must hold this part, typed as a string.
 * @param part the text the compared string must hold
 * @returns the matcher
 */

export function textContaining(part: string): string {
    return expect.stringContaining(part) as string;
}

/**
 * Require a selected check to report the expected finding and pass after correction.
 * @param repository the prepared test repository
 * @param entry the defect, expected finding, and explicit correction
 * @param scenario the repository's default correction
 */
export async function expectCheckCase(
    repository: OwnedTestRepository,
    entry: FindingCase,
    scenario: RepositoryScenario,
): Promise<void> {
    const outcome = await runCheckCase(repository.root, entry, repository.environment, repository.run);
    expect(outcome.code, `${entry.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
    const failed = JSON.parse(outcome.stdout) as RunReport;
    expect(failed.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
    expect(failed.checks[0]?.findings).toContainEqual(containing({ check: entry.check, ...entry.expected }));
    const correction = await runCheckCase(
        repository.root,
        buildCorrection(entry, scenario),
        repository.environment,
        repository.run,
    );
    expect(correction.code, `${entry.check} corrected: ${correction.stdout}${correction.stderr}`).toBe(0);
    const accepted = JSON.parse(correction.stdout) as RunReport;
    expect(accepted.checks).toMatchObject([{ check: entry.check, status: 'passed', findings: [] }]);
}

/**
 * Require a delivered check to report its test finding and pass after its explicit correction.
 * @param installation the installed CLI command
 * @param options the isolated repository and command environment
 * @param check the defect, exact finding fields, and correction
 */
export async function expectPackageCheck(
    installation: Pick<Consumer, 'command'>,
    options: ConsumerOptions,
    check: PackageCheckCase,
): Promise<void> {
    const args = [...installation.command, 'check', check.path, '--only', check.only, '--json'];
    if (check.defect !== undefined) writeFileSync(join(options.cwd, check.path), check.defect);
    const failed = await runTestCommand(args, options);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = JSON.parse(failed.stdout) as RunReport;
    expect(report.skips).toStrictEqual([]);
    expect(report.checks).toMatchObject([
        {
            check: check.only,
            status: 'failed',
            findings: check.findings.map((finding) => ({ file: check.path, ...finding })),
        },
    ]);
    if (check.isNpm !== undefined) {
        const executable = toPosix(relative(realpathSync(options.cwd), report.checks[0]!.command![0]!));
        expect(executable.startsWith('.gspot/node_modules/')).toBe(check.isNpm);
    }
    if ('fix' in check) {
        const fixed = await runTestCommand([...args, '--fix'], options);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    } else writeFileSync(join(options.cwd, check.path), check.corrected);
    const passed = await runTestCommand(args, options);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    const accepted = JSON.parse(passed.stdout) as RunReport;
    expect(accepted.skips).toStrictEqual([]);
    expect(accepted.checks).toMatchObject([{ check: check.only, status: 'passed', findings: [] }]);
}
