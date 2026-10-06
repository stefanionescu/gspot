import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';

/** The fixture contract owned by this behavior's tests. */
export type SiteReportCase = {
    name: string;
    check: string;
    analyze: (input: EngineInput) => Promise<Finding[]>;
    defect: (output: string) => Record<string, unknown> | Record<string, unknown>[];
    corrected: Record<string, unknown> | Record<string, unknown>[];
    status: number;
    file: string;
    rule: string;
};

/** SVG byte savings at the effective default or an authored percentage. */
export type SvgSavingCase = {
    name: string;
    level: 'recommended' | 'all';
    percent?: number;
    saved: number;
    finding: boolean;
};
