import type { z } from 'zod';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import type { allowlistSchema } from '#cli/parsers/schema/licenses.ts';
import type { PolicyFile, ScopeSelection } from '#cli/types/policy/settings.ts';
import type { Repository, TrackedFile } from '#cli/types/repository/inventory.ts';
import type { PackageManifest, PackageInstaller } from '#cli/types/parsers/packages.ts';
import type { ToolPin, Manifest, ParsedCheck, CheckDeclaration } from '#cli/types/configurations.ts';

/** Policy, repository inventory, and selected configurations shared by planning and generation. */
export type Session = {
    root: string;
    reads: ReadCache;
    resources?: DisposableStack;
    packageInstaller: () => PackageInstaller | undefined;
    cancelSignal?: AbortSignal;
    version: string;
    policyFiles: PolicyFile;
    manifests: Map<string, Manifest>;
    repository: Repository;
    scopes: ScopeSelection[];
};

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

/** One check to plan: its check declaration and the manifest it came from, none for a [[check]] entry. */
export type PlanEntry = { check: CheckDeclaration; manifest?: Manifest };

/** What planning one scope needs. */
export type PlanInputs = {
    session: Session;
    scope: ScopeSelection;
    options: PlanOptions;
    platform: string;
    narrow: Set<string> | undefined;
    children: string[];
    projects: PackageManifest[];
};

export type Stage = ParsedCheck['stage'];

/** Saved selection state, with an enabling setting only when it is required. */
export type SelectionStatus =
    | { cause: 'level' | 'ignore'; note: string }
    | { cause: 'setting'; note: string; setting: string };
/** A declared native ignore source and its ordered path matcher. */
export type NativeIgnore = { file: string; matches: (path: string) => boolean };

export type PlannedCheck = {
    commits?: string[];
    scope: ScopeSelection;
    check: CheckDeclaration;
    manifest?: Manifest;
    files: TrackedFile[];
    tool?: ToolPin;
    skip?: {
        cause: 'level' | 'flag' | 'platform' | 'replaced' | 'setting' | 'condition' | 'ignore' | 'inputs';
        note: string;
    };
    /** Changed paths absent from the readable tree that still trigger a project check. */
    triggerPaths: string[];
    messageFile?: string;
};

export type StageFilter = Stage | 'all';

/** A selected installed consumer and the effective license policy governing its report. */
export type LicenseProject = {
    manifest: string;
    selection: ScopeSelection;
    configuration: z.output<typeof allowlistSchema>;
    skip: SelectionStatus | undefined;
};
