import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';

/** The fixture contract owned by this behavior's tests. */
export type SiteReportCase = {
    name: string;
    analyze: (input: EngineInput) => Promise<Finding[]>;
    defect: (output: string) => Record<string, unknown> | Record<string, unknown>[];
    corrected: Record<string, unknown> | Record<string, unknown>[];
    status: number;
    file: string;
    rule: string;
};
