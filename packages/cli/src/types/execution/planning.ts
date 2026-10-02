// The types of execution/planning in this package.
import type { Session } from '#cli/types/tools/tools.ts';
import type { ScopeSelection } from '#cli/types/policy/policy.ts';
import type { Manifest, RawCheck, CheckSpec } from '#cli/types/kits.ts';
import type { StageFilter, PlannedCheck } from '#cli/types/execution/execution.ts';

export type Skip = PlannedCheck['skip'];
export type RuleSkip = {
    applies: (spec: CheckSpec, check: PlannedCheck, hasGit: boolean) => boolean;
    note: (spec: CheckSpec) => string;
};

export type PlanOptions = {
    commits?: string[];
    historyComplete?: boolean;
    stage: StageFilter;
    staged?: string[];
    changed?: string[];
    only?: string[];
    /** Root-relative paths selected by positional file and directory arguments. */
    paths?: string[];
    skips: string[];
    messageFile?: string;
};

/** One check to plan: its spec and the manifest it came from, none for a [[check]] entry. */
export type PlanEntry = { spec: CheckSpec; manifest?: Manifest };

/** What planning one scope needs. */
export type PlanInputs = {
    session: Session;
    scope: ScopeSelection;
    options: PlanOptions;
    platform: string;
    narrow: Set<string> | undefined;
    children: string[];
};

/** The platform name and architecture a run is on. */
export type Host = { platform: string; arch: string };

export type Stage = RawCheck['stage'];
