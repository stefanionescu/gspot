import type { Session } from '#cli/types/session.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { ManagedKeys } from '#cli/types/repository/repository.ts';
import { type CHECK_HOOKS, type IGNORE_SECTION_TITLES } from '#cli/config/generation/generation.ts';
import { type Tool, type Level, type Config, type Configuration, type SourcedConfig } from '#cli/types/manifests.ts';

type ManagedBlock = { path: string; body: string };

type SemgrepRule = Record<string, unknown> & { id: string; paths?: { include: string[] } };

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

export type ConfigOwner = { session: Session; scope: Scope; configuration: Configuration };

export type ConfigGeneration = {
    files: GeneratedFile[];
    targets: ReadonlyMap<string, ReadonlyMap<string, string>>;
    failures: ReadonlyMap<string, ReadonlyMap<string, Error>>;
};

export type ConfigTargets = Pick<ConfigGeneration, 'targets' | 'failures'>;

export type SemgrepDocument = { rules: SemgrepRule[] };

export type HookName = (typeof CHECK_HOOKS)[number];

export type PlannedConfig = ConfigOwner & {
    targetPath: string;
    level: Level;
    config: SourcedConfig;
};

export type RuleOptionsRun = {
    configured: string[];
    running: ReadonlySet<string>;
    allLevelRules: ReadonlySet<string>;
    level: Level;
    suffix?: string;
};

export type ConfigOutput = { content: string; companions: GeneratedFile[] };

export type ConfigBuilder = (planned: PlannedConfig) => string | ConfigOutput;

export type PlannedLinkField = {
    scope: Scope;
    configuration: Configuration;
    tool: Tool;
    consumed: boolean;
    paths: ReadonlySet<string>;
    configs: ConfigTargets;
    scopePaths: string[];
};

export type IgnoreSection = { key: keyof typeof IGNORE_SECTION_TITLES | 'settings'; title: string; patterns: string[] };

export type OwnedConfig = { config: Config; owner: ConfigOwner };

export type OwnedSourceFile = OwnedConfig & { config: SourcedConfig };

export type BuiltConfig = OwnedSourceFile & {
    file: GeneratedFile;
    companions: GeneratedFile[];
};

export type ConfigBuildState = {
    targets: Map<string, Map<string, string>>;
    files: Map<string, GeneratedFile>;
    failures: Map<string, Map<string, Error>>;
};

export type UsedNames = { tools: Set<string>; checks: Set<string> };

export type ApplyReport = {
    written: string[];
    unchanged: string[];
    removed: string[];
    updated: string[];
    notes: string[];
};

export type OutdatedFile = {
    path: string;
    kind: 'changed' | 'missing' | 'stray';
    diff?: string;
};
