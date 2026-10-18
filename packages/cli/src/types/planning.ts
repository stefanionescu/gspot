import type { ReadCache } from '#cli/types/system/files.ts';
import type { ToolInspection } from '#cli/types/tools/find.ts';
import type { PackageManager } from '#cli/types/parsers/dependency-files.ts';
import type { Repository, TrackedFile } from '#cli/types/repository/inventory.ts';
import type { SettingsFile, ScopeSelection } from '#cli/types/settings/values.ts';
import type { StartRunner, ToolFileGeneration } from '#cli/types/generation/files.ts';
import type { ConfigurationTables } from '#cli/types/settings/configuration-tables.ts';
import type { Stage, Manifest, ToolDeclaration, CheckDeclaration } from '#cli/types/configurations.ts';

/** Settings, repository inventory, and configurations shared by planning and generation. */
export type Session = {
    toolFiles: () => ToolFileGeneration;
    generatedPaths: () => ReadonlySet<string>;
    /** The checks that the settings turn on, across supported systems, planned once when the session opens. */
    configuredChecks: PlannedCheck[];
    neededToolManifests: Manifest[];
    timeoutSeconds: number;
    root: string;
    uvPath: string;
    inspections: Map<string, ToolInspection>;
    miseBinPaths: string[];
    startRunner: StartRunner;
    /** The verified working tree with the installed tools, for a scratch copy of a revision. */
    installedRoot: string;
    reads: ReadCache;
    resources: DisposableStack;
    /** The package manager with its version, which an undeclared version reads from the program. */
    getPackageManager: () => PackageManager | undefined;
    requirePackageManager: () => PackageManager;
    /** The package manager name, which starts no program. */
    getPackageManagerName: () => PackageManager['name'] | undefined;
    requirePackageManagerName: () => PackageManager['name'];
    cancelSignal?: AbortSignal | undefined;
    version: string;
    settingsFile: SettingsFile;
    manifests: Map<string, Manifest>;
    repository: Repository;
    /** The dependency files parsed from the source inventory of this session. */
    scopes: ScopeSelection[];
};

export type Skip = PlannedCheck['skip'];

/** The system name and architecture for a run. */
export type System = { platform: string; arch: string };

export type PlanOptions = {
    /** Plan the checks that the settings configure: keep checks this system cannot run, and read no ignore file that gspot writes. */
    forConfiguration?: boolean;
    base?: string;
    commits?: string[];
    historyComplete?: boolean;
    stage: StageFilter | 'any';
    staged?: string[];
    changed?: string[];
    only?: string[];
    /** Root-relative paths that the positional file and folder arguments name. */
    paths?: string[];
    messageFile?: string;
};

/** One check to plan: its check declaration and the manifest it came from, none for a [[check]] record. */
export type CheckCandidate = { check: CheckDeclaration; manifest?: Manifest };

/** What planning one scope needs. */
export type PlanInputs = {
    session: Session;
    selection: ScopeSelection;
    options: PlanOptions;
    platform: string;
    narrow: Set<string> | undefined;
    children: string[];
};

/** Saved selection state, with an enabling setting only when it must exist. */
export type SettingsSkip =
    | { cause: 'level' | 'ignore' | 'condition'; note: string }
    | { cause: 'setting'; note: string; setting: string };
/** A declared tool ignore source and its ordered path matcher. */
export type ToolIgnore = { file: string; matches: (path: string) => boolean };

export type PlannedCheck = {
    base?: string;
    commits?: string[];
    selection: ScopeSelection;
    check: CheckDeclaration;
    manifest?: Manifest;
    files: TrackedFile[];
    tool?: ToolDeclaration;
    skip?: {
        cause: 'level' | 'flag' | 'system' | 'replaced' | 'setting' | 'condition' | 'ignore' | 'inputs';
        note: string;
    };
    /** Changed paths absent from the readable tree that still trigger a project check. */
    triggerPaths: string[];
    messageFile?: string;
};

export type StageFilter = Stage | 'all';

/** An installed project and the license settings for its report. */
export type LicenseProject = {
    dependencyFile: string;
    selection: ScopeSelection;
    configuration: ConfigurationTables['licenses'];
    skip: SettingsSkip | undefined;
};
