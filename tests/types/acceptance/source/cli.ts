// The types of acceptance/source/cli in this package.

export type AuthoredState = { state: 'kept' | 'rewritten'; mode: number } | { state: 'removed' };
export type Step = { run?: string; uses?: string; if?: string; with?: Record<string, string> };
export type Generated = {
    gspot: { script: string[]; artifacts: { paths: string[]; when: string; reports: { codequality: string } } };
    jobs: Record<string, { steps: Step[] }>;
};
export type Retention = { always: boolean; keepsCodequality: boolean; manualStage?: 'manual job only' | 'every job' };
