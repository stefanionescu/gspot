import type { TextRange } from '#cli/types/system.ts';
import type { GeneratedFile } from '#cli/types/tools.ts';
import type { Scope, Settings } from '#cli/types/settings.ts';
import type { PackageManager } from '#cli/types/repository.ts';
import type { Tool, Configuration } from '#cli/types/manifests.ts';
import type { ConfigTargets } from '#cli/types/engine/tool-runs.ts';
import type { OwnedConfig } from '#cli/types/configurations/language.ts';
import type { FROZEN_INSTALLS } from '#cli/config/repository/javascript.ts';
import type { SourcedConfig, IgnoreSection } from '#cli/types/configurations/general.ts';

export type PlannedLinkField = {
    scope: Scope;
    configuration: Configuration;
    tool: Tool;
    consumed: boolean;
    paths: ReadonlySet<string>;
    configs: ConfigTargets;
    scopePaths: string[];
};

export type OwnedSourceFile = OwnedConfig & { config: SourcedConfig };

export type BuiltConfig = OwnedSourceFile & {
    file: GeneratedFile;
    companions: GeneratedFile[];
};

export type ConfigBuildState = {
    ignoreSections: IgnoreSection[];
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

export type ActionPin = { name: string; sha: string; version: string };

export type Pipeline = {
    version: string;
    packageManager?: PackageManager | undefined;
    packageManagers: CiPackageManager[];
    setupCommand?: NonNullable<Settings['ci']>['setup_command'];
    projectInstall: string[];
    operatingSystems: NonNullable<Settings['ci']>['operating_systems'];
    linuxRunner: NonNullable<Settings['ci']>['linux_runner'];
    lockfiles: string[];
};

export type FrozenLockfile = keyof typeof FROZEN_INSTALLS;

export type CiPackageManager = (typeof FROZEN_INSTALLS)[FrozenLockfile][0];

export type RuleFile = {
    path: string;
    target: string;
    content: string;
    scopes: string[];
    group: Configuration['group'];
};

export type AgentsBlockContent = {
    files: RuleFile[];
    managedKeys: { path: string; keys: string[] }[];
    startCommand: string;
    hasOwnTitle: boolean;
};

export type RuleSection = {
    start: number;
    end: number;
    depth: number;
    marker: TextRange | undefined;
};
