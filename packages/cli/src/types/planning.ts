import type { ReadCache } from '#cli/types/system/files.ts';
import type { ToolInspection } from '#cli/types/tools/find.ts';
import type { ParsedLicenses } from '#cli/types/checks/general.ts';
import type { Repository, TrackedFile } from '#cli/types/repository/inventory.ts';
import type { SettingsFile, ScopeSelection } from '#cli/types/settings/values.ts';
import type { StartRunner, ToolFileGeneration } from '#cli/types/generation/files.ts';
import type { PackageManager, DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import type { Stage, Manifest, ToolDeclaration, CheckDeclaration } from '#cli/types/configurations.ts';

/** Settings, repository inventory, and selected configurations shared by planning and generation. */
export type Session = {
    toolFiles: () => ToolFileGeneration;
    generatedPaths: () => ReadonlySet<string>;
    /** Settings-enabled checks across supported operating systems, planned once at session creation. */
    configuredChecks: PlannedCheck[];
    neededToolManifests: Manifest[];
    timeoutSeconds: number;
    root: string;
    uvPath: string;
    inspections: Map<string, ToolInspection>;
    miseBinPaths: string[];
    startRunner: StartRunner;
    /** The verified working installation for a revision copy. */
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
    /** Package manifests parsed from this session's source inventory. */
    dependencyFiles: DependencyFile[];
    scopes: ScopeSelection[];
};

export type Skip = PlannedCheck['skip'];

/** The operating system name and architecture for a run. */
export type System = { platform: string; arch: string };

export type PlanOptions = {
    includeUnsupported?: boolean;
    base?: string;
    commits?: string[];
    historyComplete?: boolean;
    stage: StageFilter | 'any';
    staged?: string[];
    changed?: string[];
    only?: string[];
    /** Root-relative paths selected by positional file and directory arguments. */
    paths?: string[];
    messageFile?: string;
};

/** One check to plan: its check declaration and the manifest it came from, none for a [[check]] record. */
export type CheckCandidate = { check: CheckDeclaration; manifest?: Manifest };

/** What planning one scope needs. */
export type PlanInputs = {
    session: Session;
    scope: ScopeSelection;
    options: PlanOptions;
    platform: string;
    narrow: Set<string> | undefined;
    children: string[];
    projects: DependencyFile[];
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
    scope: ScopeSelection;
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

/** A selected installed consumer and the effective license settings governing its report. */
export type LicenseProject = {
    manifest: string;
    selection: ScopeSelection;
    configuration: ParsedLicenses;
    skip: SettingsSkip | undefined;
};
