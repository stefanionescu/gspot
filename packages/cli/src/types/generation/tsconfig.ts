import type { ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';

/** Project inputs and required options owned by one generated TypeScript configuration. */
export type TsconfigInput = {
    root: string;
    target: string;
    scope: string;
    files: TrackedFile[];
    scopeEntries: ScopeEntry[];
    options: Record<string, boolean>;
};
