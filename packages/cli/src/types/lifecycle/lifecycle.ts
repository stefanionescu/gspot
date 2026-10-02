// The types of lifecycle in this package.
import type { Read } from '#cli/types/platform/platform.ts';
import type { ToolOwner, InstallationKind } from '#cli/types/tools/tools.ts';
import type { Outcome, OwnedKind, OwnershipEntry } from '#cli/types/lifecycle/ownership.ts';
import type { Generated, BlockStyle, ConfigurationFormat } from '#cli/types/generation/generation.ts';

export type WriteRequest = {
    root: string;
    rendered: Generated;
    report: ApplyReport;
    retained: { prose: boolean; packages: boolean };
    replace?: ReadonlyMap<string, Read> | undefined;
    regenerate?: ReadonlyMap<string, Read>;
};

export type ApplyReport = {
    preserved: string[];
    written: string[];
    unchanged: string[];
    removed: string[];
    blocks: string[];
    packages: string[];
    notes: string[];
};

export type ConfigurationOwnership = NonNullable<OwnershipEntry['configuration']>;

export type DriftEntry = {
    path: string;
    kind: 'changed' | 'missing' | 'stray' | 'conflict';
    diff?: string;
    rules?: { path: string; added: string[]; removed: string[]; changed: string[] }[];
    ruleError?: string;
};

/** What one operation proposes for one file: the file now, its record, the outcome, and what to write. */
export type Planned = {
    path: string;
    current: Read | undefined;
    previous: OwnershipEntry | undefined;
    status: 'changed' | 'unchanged' | 'preserved';
    next?: Read;
    entry?: OwnershipEntry;
};

export type Owner = ToolOwner & {
    beginInstallation(kind: InstallationKind): void;
    finishInstallation(kind: InstallationKind): void;
    removeInstallation(kind: InstallationKind): void;
    proposeConfiguration(
        path: string,
        format: ConfigurationFormat,
        changes: { path: (string | number)[]; value: unknown }[],
        replace?: boolean,
    ): Planned;
    proposeReplacement(
        path: string,
        next: Read,
        kind: OwnedKind,
        replace?: boolean,
        expected?: Read,
        proposed?: ReadonlyMap<string, Read | undefined>,
    ): Planned;
    proposeBlock(path: string, body: string, style: BlockStyle): Planned;
    applyPlan(plan: Planned): Outcome;
    applyPlans(plans: Planned[]): Outcome[];
    replaceBlock(path: string, body: string, style: BlockStyle): Outcome;
    paths(): string[];
    installedPaths(): string[];
    proposeRetirement(path: string, expected: Read): Planned;
    replace(path: string, next: Read, kind: OwnedKind, replace?: boolean, expected?: Read): Outcome;
    proposeRestoration(path: string): Planned;
    proposeClaudeMove(): Planned[];
    close(): void;
};
