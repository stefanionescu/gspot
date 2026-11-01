import type { z } from 'zod';
import type { Scope, Settings } from '#cli/types/settings.ts';
import type { uvLockfileSchema } from '#cli/schemas/parsers.ts';
import type { CHECK_HOOKS } from '#cli/config/tools/installers.ts';
import type { LOCKFILES } from '#cli/config/repository/javascript.ts';
import type { Tool, Check, Configuration } from '#cli/types/manifests.ts';
import type { Files, RunCache, AsyncSpawnOptions } from '#cli/types/system.ts';
import type { bunPackageSchema, lintRuleDocsSchema, uvProjectSettingsSchema } from '#cli/schemas/tools.ts';

import type {
    Repository,
    ManagedKeys,
    StartRunner,
    PackageManager,
    PackageManagerPin,
    PackageManagerCommand,
} from '#cli/types/repository.ts';

export type ProseRoute = { path: string; mode: 'path' | 'stdin'; extension: string };

export type Host = { platform: string; arch: string };

export type ConfiguredCheck = {
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
    kind?: 'workflow';
};

export type Generation = {
    files: GeneratedFile[];
    blocks: ManagedBlock[];
    managedKeys: ManagedKeys[];
};

export type HookName = (typeof CHECK_HOOKS)[number];

export type PackagePin = {
    kind: Exclude<ToolFolderKind, 'vale'>;
    name: string;
    version: string;
    requires?: readonly string[];
};

export type MiseToolPin = {
    name: string;
    version: string;
    options?: Record<string, string | number | boolean> | undefined;
    checksums: Record<string, string>;
};

type ToolFolderKind = 'npm' | 'python' | 'vale';

export type PackagePins = { npm: Record<string, string>; python: string[] };

export type UvLockfile = z.infer<typeof uvLockfileSchema>;

export type Session = {
    configuredChecks: ConfiguredCheck[];
    toolConfigurations: Configuration[];
    timeoutSeconds: number;
    root: string;
    inspections: Map<string, ToolInspection>;
    startRunner: StartRunner;
    toolsRoot: string;
    cache: RunCache;
    resources: Disposable[];
    packageManager: PackageManagerPin | undefined;
    cancelSignal?: AbortSignal | undefined;
    settings: Settings;
    settingsText: string;
    configurationsByName: Map<string, Configuration>;
    repository: Repository;
    scopes: Scope[];
};

type ToolState = 'ok' | 'outdated' | 'newer' | 'missing' | 'system' | 'error';

export type InspectedTool = {
    timeoutSeconds: number;
    root: string;
    cwd: string;
    tool: Tool;
    missing: ToolInspection;
    help: string;
    want: string | undefined;
    miseBinPaths: string[] | undefined;
};

export type ToolInspection = {
    name: string;
    state: ToolState;
    want?: string | undefined;
    found?: string | undefined;
    path?: string | undefined;
    help?: string | undefined;
    note?: string | undefined;
    minimumVersion?: string | undefined;
};

export type ToolSearch = {
    timeoutSeconds: number;
    root: string;
    toolsRoot?: string;
    cwd?: string;
    inspections: Map<string, ToolInspection>;
    miseBinPaths?: string[];
};

export type ExecutableSearch = {
    folders: string[];
    miseBinPaths?: string[] | undefined;
    toolFolderKind?: ToolFolderKind | undefined;
};

export type ParsedToolVersion = { version: string } | { state: 'missing' | 'error'; note: string };

export type ArchiveDownload = {
    url: string;
    name: string;
    limit: number;
};

export type HookStatus = { ready: boolean; text: string; tool?: string; lines?: string[] };

export type HookPlan = { command?: readonly string[]; note: string };

export type InstallResult = { installed: string[]; notes: string[]; steps: readonly (readonly string[])[] };

export type ToolPackageManager = PackageManager & {
    name: Exclude<PackageManager['name'], 'yarn'>;
    command: PackageManagerCommand;
};

export type ToolInstall = {
    session: Session;
    packageManager: ToolPackageManager | undefined;
    releaseAgeDays: number;
    writer: Files;
    generated: Generation;
    tools: Tool[];
    checkTools: Set<string>;
    misePath: string | null;
    steps: (readonly string[])[];
};

export type MiseInstall = { installed: string; note: string; binPaths: string[] };

export type StaleLockfile = { path: string; kind: 'absent' | 'changed' };

export type UvCommand = {
    runFolder: string;
    commandArguments: readonly string[];
    executable: string;
    credentials: string[];
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
    packageManager: ToolPackageManager;
    commandArguments: string[];
    failure: string;
    environment: Record<string, string>;
};

export type PackageManagerRun = {
    environment: Record<string, string>;
    credentials: string[];
};

export type BunPackage = z.infer<typeof bunPackageSchema>;

export type LockedTarball = { name: string; version: string; address: string; integrity: string };

export type Lockfile = (typeof LOCKFILES)[number];

export type ToolProjectLockfileName = Extract<Lockfile, { toolProject: true }>['file'];

export type LintRuleDocs = z.infer<typeof lintRuleDocsSchema>;

export type ToolRunOptions = Pick<AsyncSpawnOptions, 'cwd' | 'env' | 'stdin'> & {
    timeoutSeconds: number;
    cancelSignal?: AbortSignal | undefined;
};

export type ToolAvailability = { path: string } | ProcessFailure;

export type ProcessFailure = { status: 'error' | 'missing'; note: string };

export type InstalledDependency = { path: string; version: string | undefined };

export type RuleDocsOptions = {
    timeoutSeconds?: number | undefined;
    readMiseBinPaths?: (() => string[]) | undefined;
};

export type RuleToolSearch = RuleDocsOptions & { timeoutSeconds: number };
