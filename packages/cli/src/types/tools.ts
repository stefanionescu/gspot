import type { z } from 'zod';

import type { LOCKFILES } from '#cli/config/parsers/projects.ts';
import type { CHECK_HOOKS } from '#cli/config/tools/installers.ts';
import type {
    bunPackageSchema,
    installResultSchema,
    miseLockfileSchema,
    ruleExplanationSchema,
    toolInspectionSchema,
    uvLockfileSchema,
    uvProjectSettingsSchema,
} from '#cli/schemas/tools.ts';
import type { Check, Configuration, Tool, ToolInstallers } from '#cli/types/manifests.ts';
import type {
    ManagedKeys,
    PackageManager,
    PackageManagerCommand,
    PackageManagerPin,
    Repository,
    StartRunner,
    ToolPackageManagerName,
} from '#cli/types/repository.ts';
import type { Scope, Settings } from '#cli/types/settings.ts';
import type { CancelableSpawnOptions, Files, RunCache } from '#cli/types/system.ts';

export type Host = { platform: string; arch: string };

export type ScopeCheck = {
    scope: Scope;
    check: Check;
    configuration?: Configuration | undefined;
    tool?: Tool | undefined;
};

type ManagedBlock = { path: string; body: string };

export type GeneratedFile = {
    path: string;
    content: string;
    executable?: boolean;
};

export type Generation = {
    files: GeneratedFile[];
    blocks: ManagedBlock[];
    managedKeys: ManagedKeys[];
};

export type HookName = (typeof CHECK_HOOKS)[number];

export type PackagePin = {
    kind: ToolFolderKind;
    name: string;
    version: string;
    requires?: readonly string[];
};

export type MiseToolPin = NonNullable<ToolInstallers['mise']>;

type ToolFolderKind = 'npm' | 'python';

export type PackagePins = { npm: Record<string, string>; python: string[] };

export type UvLockfile = z.infer<typeof uvLockfileSchema>;

export type MiseLockfile = z.infer<typeof miseLockfileSchema>;

export type Session = SessionBase & {
    toolConfigurations: Configuration[];
    packageManager: PackageManagerPin | undefined;
    toolPackageManager: ToolPackageManagerName | undefined;
};

export type SessionBase = {
    configuredChecks: ScopeCheck[];
    root: string;
    startRunner: StartRunner;
    toolsRoot: string;
    cache: RunCache;
    toolCache: RunCache;
    resources: Disposable[];
    cancelSignal?: AbortSignal | undefined;
    settings: Settings;
    repository: Repository;
    scopes: Scope[];
};

export type InspectedTool = {
    timeoutSeconds: number;
    root: string;
    cwd: string;
    tool: Tool;
    missing: ToolInspection;
    want: string | undefined;
    miseBinPaths: string[] | undefined;
    runsVersionCommand: boolean | undefined;
};

export type ToolInspection = z.infer<typeof toolInspectionSchema>;

export type ToolSearch = {
    settings: Pick<Settings, 'tool_timeout_seconds'>;
    root: string;
    toolsRoot?: string;
    cwd?: string;
    miseBinPaths?: string[];
    miseFailure?: string | undefined;
    runsVersionCommand?: boolean;
};

export type ToolFolders = { root: string; cwd: string };

export type MiseBinPaths = { folders: string[]; failure?: string | undefined };

export type MiseTrust = { variables: Record<string, string> } | { refusal: string };

export type ExecutableList = { paths: string[]; failure?: string | undefined };

export type ExecutableSearch = {
    folders: string[];
    miseBinPaths?: string[] | undefined;
    toolFolderKind?: ToolFolderKind | undefined;
};

export type ParsedToolVersion = { version: string } | { state: 'missing' | 'error'; note: string };

export type DownloadSession = Pick<Session, 'cancelSignal'> & { settings: Pick<Settings, 'tool_timeout_seconds'> };

export type ArchiveDownload = {
    url: string;
    name: string;
    limit: number;
    sha256: string;
    refusal: string;
};

export type HookStatus = { ready: boolean; text: string; tool?: string | undefined; lines?: string[] | undefined };

export type HookPlan = { command?: readonly string[]; note: string };

export type InstallResult = z.infer<typeof installResultSchema>;

export type ToolPackageManager = PackageManager & {
    name: ToolPackageManagerName;
    command: PackageManagerCommand;
};

export type ToolInstall = {
    session: Session;
    packageManager: ToolPackageManager | undefined;
    pythonSettings: PythonIndexSettings;
    releaseAgeDays: number;
    writer: Files;
    generated: Pick<Generation, 'files'>;
    tools: Tool[];
    checkTools: Set<string>;
    misePath: string | undefined;
    runsProjectInstall?: boolean;
    steps: Array<readonly string[]>;
};

export type ToolRelease = { label: string; kind: ToolFolderKind; version: string; url: string };

export type MiseInstall = { installed: string; note: string; binPaths: string[]; tools: Tool[] };

export type ToolProjectsInstall = { installed: string[]; tools: Tool[] };

export type BrokenTool = { tool: Tool; inspection: ToolInspection };

export type StaleLockfile = { path: string; kind: 'absent' | 'changed' };

export type UvCommand = {
    runFolder: string;
    commandArguments: readonly string[];
    executable: string;
    config?: string;
};

export type PythonIndexSettings = {
    settings: z.infer<typeof uvProjectSettingsSchema>['tool']['uv'];
    credentials: string[];
};

export type PythonToolProject = { name: string; version: string; 'requires-python': string; dependencies: string[] };

export type NpmToolInstall = ToolInstall & {
    packageManager: ToolPackageManager;
    registryEnvironment: Record<string, string>;
};

export type PackageManagerRequest = {
    runFolder: string;
    commandArguments: string[];
    failure: string;
};

export type PackageManagerRun = {
    environment: Record<string, string>;
    credentials: string[];
};

export type BunPackage = z.infer<typeof bunPackageSchema>;

export type LockedTarball = { name: string; version: string; address: string; integrity: string };

export type Lockfile = (typeof LOCKFILES)[number];

export type ToolProjectLockfileName = Extract<Lockfile, { toolProject: true }>['file'];

export type RuleExplanation = z.infer<typeof ruleExplanationSchema>;

export type RuleExplanations = Readonly<Record<string, RuleExplanation>>;

export type ToolRunOptions = CancelableSpawnOptions & { timeoutSeconds: number };

export type ToolAvailability = ProcessFailure | { path: string };

export type ProcessFailure = { status: 'error' | 'missing' | 'canceled'; note: string };

export type InstalledDependency = { path: string; version: string | undefined };

export type RuleExplanationOptions = {
    help: string;
    timeoutSeconds?: number | undefined;
    readMiseBinPaths?: (() => Promise<string[]>) | undefined;
};

export type ToolLookupSession = Pick<
    Session,
    'root' | 'scopes' | 'toolCache' | 'toolsRoot' | 'settings' | 'toolConfigurations'
> &
    Pick<ToolSearch, 'runsVersionCommand'>;

export type RuleToolSearch = RuleExplanationOptions & { timeoutSeconds: number };
