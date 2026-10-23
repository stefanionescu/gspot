import type { Session } from '#cli/types/session.ts';
import type { ManagedKeys } from '#cli/types/apply.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { CHECK_HOOKS } from '#cli/config/generation/hooks.ts';
import type { BlockStyle } from '#cli/types/parsers/managed-blocks.ts';
import type { Tool, Level, ConfigFile, Configuration } from '#cli/types/configurations.ts';
import type { IGNORE_SECTION_TITLES } from '#cli/config/generation/config-files/ignore-files.ts';

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

/** The configuration that declares the config file, and its scope. */
export type ConfigFileOwner = { session: Session; scope: Scope; configuration: Configuration };

/** Generated config files and the chosen target for each scope and config file. */
export type ConfigFileGeneration = {
    files: GeneratedFile[];
    targets: ReadonlyMap<string, ReadonlyMap<string, string>>;
};

export type SemgrepDocument = { rules: SemgrepRule[] };

export type HookName = (typeof CHECK_HOOKS)[number];

export type PlannedNpmProject = {
    root: string;
    scopes: Scope[];
    configurations: Configuration[];
    /** Yarn 2 or later, which needs the settings that keep a node_modules folder. */
    isYarnBerry: boolean;
};

export type WholeConfigFile = Extract<ConfigFile, { source: string }>;

/** The repository, scope, config file, and destination of one whole config file. */
export type PlannedConfigFile = ConfigFileOwner & { targetPath: string; level: Level; configFile: WholeConfigFile };

/** The text of a config file, and the files that it imports, such as the ESLint config file of each configuration. */
export type ConfigFileOutput = { content: string; companions: GeneratedFile[] };

/** Build the text of one config file; buildConfigFile adds the header and the final newline to each file. */
export type ConfigFileBuilder = (planned: PlannedConfigFile) => string | ConfigFileOutput;

/** A tool and the generated destinations that can replace its package fields. */
export type PlannedPointerField = {
    scope: Scope;
    configuration: Configuration;
    tool: Tool;
    consumed: boolean;
    paths: ReadonlySet<string>;
    targets: ConfigFileGeneration['targets'];
    scopePaths: string[];
};

/** One ignore group and the reason shown above its paths. */
export type IgnoreSection = { key: keyof typeof IGNORE_SECTION_TITLES | 'settings'; title: string; patterns: string[] };

/** A config file paired with the repository and scope that own it. */
export type OwnedConfigFile = { configFile: ConfigFile; owner: ConfigFileOwner };

/** A whole config file with the text built for one scope. */
export type BuiltConfigFile = OwnedConfigFile & {
    configFile: WholeConfigFile;
    file: GeneratedFile;
    companions: GeneratedFile[];
};

/** The mutable destinations and output files collected during one generation. */
export type GeneratedConfigFiles = { targets: Map<string, Map<string, string>>; files: Map<string, GeneratedFile> };

/** The check and program names that make a config file apply. */
export type UsedNames = { tools: Set<string>; checks: Set<string> };

/** A component file dialect, its parser, and the syntax it allows. */
export type StylelintComponent = {
    files: readonly string[];
    customSyntax: string;
    ignorePseudoClasses: readonly string[];
    functions?: readonly string[];
};
