import type { Session } from '#cli/types/session.ts';
import type { ManagedKeys } from '#cli/types/apply.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { CHECK_HOOKS } from '#cli/config/generation/hooks.ts';
import type { BlockStyle } from '#cli/types/parsers/formats/managed-blocks.ts';
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';
import type { IGNORE_SECTION_TITLES } from '#cli/config/generation/config-files/ignore-files.ts';

import {
    type Tool,
    type Level,
    type ConfigFile,
    type Configuration,
    type SourcedConfigFile,
} from '#cli/types/configurations.ts';

type ManagedBlock = { path: string; block: string; style: BlockStyle };

type SemgrepRule = Record<string, unknown> & { id: string; paths?: { include: string[] } };

export type GeneratedFile = {
    path: string;
    content: string;
    executable?: boolean;
    read?: FileContents | undefined;
    kind?: 'lock' | 'workflow';
};

export type GenerationResult = {
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

export type PlannedNpmProject = {
    configurations: Configuration[];
    packageManager: PackageManager['name'];
};

export type PlannedConfigFile = ConfigFileOwner & {
    targetPath: string;
    level: Level;
    configFile: SourcedConfigFile;
};

export type RuleOptionsRun = {
    chosen: string[];
    running: ReadonlySet<string>;
    higher: ReadonlySet<string>;
    level: Level;
    suffix?: string;
};

export type ConfigFileOutput = { content: string; companions: GeneratedFile[] };

export type ConfigFileBuilder = (planned: PlannedConfigFile) => string | ConfigFileOutput;

export type PlannedPointerField = {
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

export type GeneratedConfigFiles = {
    targets: Map<string, Map<string, string>>;
    files: Map<string, GeneratedFile>;
    failures: Map<string, Map<string, Error>>;
};

export type UsedNames = { tools: Set<string>; checks: Set<string> };

export type StylelintComponent = {
    files: readonly string[];
    customSyntax: string;
    ignorePseudoClasses: readonly string[];
    functions?: readonly string[];
};
