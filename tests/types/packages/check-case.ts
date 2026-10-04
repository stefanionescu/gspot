import type { Finding } from '#cli/types/execution/runtime.ts';

/** A delivered check's test findings and the explicit operation that corrects them. */
export type PackageCheckCase = {
    only: string;
    path: string;
    defect?: string;
    findings: Partial<Finding>[];
    isNpm?: boolean;
} & ({ corrected: string } | { fix: true });
