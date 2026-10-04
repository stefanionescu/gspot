import type { Level } from '#cli/types/rules.ts';
import type { Drift } from '#cli/types/lifecycle/output.ts';

/** One public policy transition and its expected native rule changes. */
export type RulePreviewCase = {
    name: string;
    configurations: string[];
    file: string;
    source: Record<string, string>;
    initialLevel: Level;
    proposedLevel: Level;
    initialTables: string;
    changes: NonNullable<Drift['rules']>;
};
