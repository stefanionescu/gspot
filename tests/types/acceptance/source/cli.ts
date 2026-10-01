// The types of acceptance/source/cli in this package.

export type Step = { run?: string; uses?: string; if?: string; with?: Record<string, string> };
export type Generated = {
    gspot: { script: string[] };
    jobs: Record<string, { steps: Step[] }>;
};
