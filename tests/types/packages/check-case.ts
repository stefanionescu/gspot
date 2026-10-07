import type { Finding } from '#cli/types/parsers/output.ts';
import type { SpawnOutcome } from '#tests/types/harness/command.ts';
import type { CheckCaseOutcome } from '#tests/types/harness/check-case.ts';

/** A delivered check's test findings and the explicit operation that corrects them. */
export type PackageCheckCase = {
    only: string;
    path: string;
    defect?: string;
    findings: Partial<Finding>[];
    isNpm?: boolean;
} & ({ corrected: string } | { fix: true });

/** Raw process evidence and parsed reports for the owning test's defect and correction assertions. */
export type PackageCheckOutcome = CheckCaseOutcome & {
    fixed: SpawnOutcome | undefined;
};
