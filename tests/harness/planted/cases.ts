// One installed repository per table, and each planted defect as an edit that is restored: the check fails with the
// expected finding, then the corrected repository passes.
import { testdir } from 'testdirs';
import { run } from '#tests/harness/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { containing } from '#tests/harness/expectations.ts';
import { plant } from '#tests/harness/planted/preservation.ts';
import { hasLinuxDocker } from '#tests/harness/cli/platforms.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { installSandbox } from '#tests/harness/planted/sandbox.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import type { Planted, FindingCase, PlantedInput, SpawnOutcome, PlantedRepository } from '#tests/types/cli.ts';

// The check fails with the planted defect, and the finding is where the case says.
async function expectDefect(planted: Planted, entry: FindingCase): Promise<void> {
    const outcome = await runPlanted(planted.root, entry, planted.environment);
    expect(outcome.code, `${entry.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
    const failed = JSON.parse(outcome.stdout) as RunReport;
    expect(failed.checks).toMatchObject([{ check: entry.check, status: 'fail' }]);
    expect(failed.checks[0]?.findings).toContainEqual(containing({ check: entry.check, ...entry.expected }));
}

// The clean rerun plants the correction under the case's policy and executable bits, unless it names its own.
function correctionOf(entry: FindingCase, repository: PlantedRepository): PlantedInput {
    const given = entry.corrected ?? repository.corrected?.(entry) ?? { files: {} };
    const policy = 'policy' in given ? given.policy : entry.policy;
    const executable = 'executable' in given ? given.executable : entry.executable;
    const kept = { policy, executable, removed: given.removed };
    const defined = Object.entries(kept).filter(([, value]) => value !== undefined);
    return { check: entry.check, files: given.files, ...Object.fromEntries(defined) };
}

// The check passes once the correction is planted.
async function expectCorrection(planted: Planted, entry: FindingCase, repository: PlantedRepository): Promise<void> {
    const outcome = await runPlanted(planted.root, correctionOf(entry, repository), planted.environment);
    expect(outcome.code, `${entry.check} corrected: ${outcome.stdout}${outcome.stderr}`).toBe(0);
    const accepted = JSON.parse(outcome.stdout) as RunReport;
    expect(accepted.checks).toMatchObject([{ check: entry.check, status: 'ok', findings: [] }]);
}

/** A clean bash script every planted repository starts from. Its main holds enough statements not to be trivial. */
export const script =
    '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\nmain() {\n    local name="$1"\n    local greeting="hello ${name}"\n    echo "${greeting}"\n}\n\nmain "$@"\n';

/**
 * Plants one defect in an installed repository, runs its check alone, and restores the repository.
 * @param cwd the planted repository, already installed
 * @param planted the defect
 * @param environment extra variables, such as the PATH of the tools
 * @returns the exit code and the output of the check
 */
export async function runPlanted(
    cwd: string,
    planted: PlantedInput & { expected?: unknown },
    environment: Record<string, string>,
): Promise<SpawnOutcome> {
    const restore = plant(cwd, planted);
    try {
        // A case may build a site twice, which takes minutes on a slow runner.
        return await run(cwd, ['check', '--only', planted.check, '--json'], environment, PLANTED_TIMEOUT_MS * 4);
    } finally {
        restore();
    }
}

/**
 * Installs the repository once, then runs each case as an edit that is restored: the check reports the planted defect
 * where the case says, and the corrected repository passes. Tests that need the same repository register through
 * `more`, which receives the installed repository.
 * @param name the kit or family under test
 * @param repository what the repository holds and selects
 * @param cases the planted defects
 * @param more tests over the same installed repository, registered inside the table's describe block
 */
export function plantedCases(
    name: string,
    repository: PlantedRepository,
    cases: FindingCase[],
    more?: (planted: () => Planted) => void,
): void {
    describe(name, () => {
        let sandbox: Awaited<ReturnType<typeof testdir>> | undefined;
        let planted: Planted | undefined;
        const installed = (): Planted => {
            if (planted === undefined) throw new Error(`The ${name} repository is not installed.`);
            return planted;
        };
        // Installing the private tools of a kit takes longer than one case on a cold runner.
        beforeAll(async () => {
            sandbox = await testdir({}, repository.dirname === undefined ? {} : { dirname: repository.dirname });
            const environment = await installSandbox(sandbox.path, repository);
            planted = { root: sandbox.path, environment };
            await repository.prepare?.(sandbox.path, environment);
        }, PLANTED_TIMEOUT_MS * 4);
        afterAll(async () => {
            await sandbox?.[Symbol.asyncDispose]();
        });
        for (const entry of cases) {
            const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
            const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
            test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker))(
                `${entry.check} reports ${where} and accepts the correction`,
                async () => {
                    await expectDefect(installed(), entry);
                    await expectCorrection(installed(), entry, repository);
                },
                PLANTED_TIMEOUT_MS * 8,
            );
        }
        more?.(installed);
    });
}
