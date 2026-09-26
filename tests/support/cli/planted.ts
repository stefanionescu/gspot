import { expect } from 'bun:test';
import type { Finding } from '#cli/checks/result.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { run, type SpawnOutcome } from '#tests/support/cli/command.ts';
import { plant, type PlantedInput } from '#tests/support/cli/preservation.ts';

/** A planted case that checks a diagnostic substring. */
export type PlantedCase = PlantedInput & { expected: string };

/** A planted case that checks a finding at its source location. */
export type FindingCase = PlantedInput & {
    expected: Pick<Finding, 'file'> & Partial<Pick<Finding, 'rule' | 'line' | 'column' | 'message'>>;
};

/** A clean bash script every planted repository starts from. */
export const script =
    '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# gspot-ignore structure/trivial-function -- reason: Bash script policy requires this main entry point.\nmain() {\n    echo "hello $1"\n}\n\nmain "$@"\n';

/**
 * Plants one defect in an installed repository, runs its check alone, and restores the repository.
 * @param cwd the planted repository, already installed
 * @param planted the defect
 * @param environment extra variables, such as the PATH of the tools
 * @returns the exit code and the output of the check
 */
export async function runPlanted(
    cwd: string,
    planted: PlantedInput & { expected?: string | { file: string } },
    environment: Record<string, string>,
): Promise<SpawnOutcome> {
    const restore = plant(cwd, planted);
    try {
        return await run(cwd, ['check', '--only', planted.check, '--no-cache'], environment);
    } finally {
        restore();
    }
}

/**
 * Runs one check over a corrected repository and fails unless it passes with no findings.
 * @param cwd the installed repository
 * @param check the check
 * @param environment extra variables, such as the PATH of the tools
 */
export async function expectCorrected(cwd: string, check: string, environment: Record<string, string>): Promise<void> {
    const corrected = await run(cwd, ['check', '--only', check, '--no-cache', '--json'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
        { check, status: 'ok', findings: [] },
    ]);
}
