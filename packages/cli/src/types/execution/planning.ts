import type { Session } from '#cli/types/execution/session.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { StageFilter, PlannedCheck } from '#cli/types/execution/runtime.ts';
import type { Manifest, RawCheck, CheckSpec } from '#cli/types/configurations.ts';

export type Skip = PlannedCheck['skip'];

/** The platform name and architecture a run is on. */
export type Host = { platform: string; arch: string };

export type PlanOptions = {
    includeUnsupported?: boolean;
    commits?: string[];
    historyComplete?: boolean;
    stage: StageFilter | 'any';
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

export type Stage = RawCheck['stage'];

/** Saved selection state, with an enabling setting only when it is required. */
export type SelectionStatus =
    | { cause: 'level' | 'ignore'; note: string }
    | { cause: 'setting'; note: string; setting: string };
/** A declared native ignore source and its ordered path matcher. */
export type NativeIgnore = { file: string; matches: (path: string) => boolean };
