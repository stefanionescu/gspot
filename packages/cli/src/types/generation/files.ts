import type { Session } from '#cli/types/session.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { ManagedKeys } from '#cli/types/repository/repository.ts';
import { type CHECK_HOOKS, type IGNORE_SECTION_TITLES } from '#cli/config/generation/generation.ts';

import {
    type Tool,
    type Level,
    type ConfigFile,
    type Configuration,
    type SourcedConfigFile,
} from '#cli/types/manifests.ts';

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

export type ConfigFileOwner = { session: Session; scope: Scope; configuration: Configuration };

export type ConfigFileGeneration = {
    files: GeneratedFile[];
    targets: ReadonlyMap<string, ReadonlyMap<string, string>>;
    failures: ReadonlyMap<string, ReadonlyMap<string, Error>>;
};

export type ConfigFileTargets = Pick<ConfigFileGeneration, 'targets' | 'failures'>;

export type SemgrepDocument = { rules: SemgrepRule[] };

export type HookName = (typeof CHECK_HOOKS)[number];

export type PlannedConfigFile = ConfigFileOwner & {
    targetPath: string;
    level: Level;
    configFile: SourcedConfigFile;
};

export type RuleOptionsRun = {
    configured: string[];
    running: ReadonlySet<string>;
    allLevelRules: ReadonlySet<string>;
    level: Level;
    suffix?: string;
};

export type ConfigFileOutput = { content: string; companions: GeneratedFile[] };

export type ConfigFileBuilder = (planned: PlannedConfigFile) => string | ConfigFileOutput;

export type PlannedLinkField = {
    scope: Scope;
    configuration: Configuration;
    tool: Tool;
    consumed: boolean;
    paths: ReadonlySet<string>;
    configFiles: ConfigFileTargets;
    scopePaths: string[];
};

export type IgnoreSection = { key: keyof typeof IGNORE_SECTION_TITLES | 'settings'; title: string; patterns: string[] };

export type OwnedConfigFile = { configFile: ConfigFile; owner: ConfigFileOwner };

export type OwnedSourceFile = OwnedConfigFile & { configFile: SourcedConfigFile };

export type BuiltConfigFile = OwnedSourceFile & {
    file: GeneratedFile;
    companions: GeneratedFile[];
};

export type ConfigFileBuildState = {
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
