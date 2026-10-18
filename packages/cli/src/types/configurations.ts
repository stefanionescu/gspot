import type { JsonValue } from '#cli/types/parsers/json.ts';
import type { Defined, Optional } from '#cli/types/shapes.ts';
import type { NamingOverride } from '#cli/types/checks/general.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { FileKind } from '#cli/types/repository/inventory.ts';
import type { TOOL_FOLDER_KINDS } from '#cli/config/system/locations.ts';
import type { OutputSpec, OutputInput } from '#cli/types/runs/output.ts';
import type { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';
import type { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependency-files.ts';

import type {
    LEVELS,
    STAGES,
    GROUPS,
    TOOL_KINDS,
    CHECK_RUNS,
    TOOL_BUILDS,
    CHECK_NEEDS,
    CHECK_WORKING_FOLDERS,
} from '#cli/config/configurations.ts';

type InstallerInput = string | Defined<Required<Pick<InstallerPin, 'name' | 'version'>>>;

export type SelectionWalk = {
    manifests: Map<string, Manifest>;
    errors: string[];
    order: Manifest[];
    seen: Set<string>;
};

/** manifest.toml as the schema accepts it. */
export type ParsedManifest = {
    defaults: Record<string, JsonValue>;
    eslint: {
        all_level_rules: EslintAllRules;
        /** A syntax selector, for every source file or for the files that a setting lists. */
        selectors: { selector: string; message: string; files_setting?: string | undefined }[];
        rules_off: { rules: string[]; reason: string; files?: string[] | undefined }[];
        /** Whether the configuration adds a block to the ESLint tool file of javascript. */
        fragment: boolean;
        /** The packages ESLint loads for that block. */
        required_tools: string[];
    };
    shared_prefixes: { prefixes: string[]; kinds: string[] };
    ignored_folders: string[];
    generated: string[];
    allowed_words: string[];
    configuration: {
        name: string;
        group: (typeof GROUPS)[number];
        title: string;
        requires: string[];
        suggests: string[];
        always_selected: boolean;
        when?: { git: true } | undefined;
        description: string;
    };
    detect: {
        content: Record<string, string>;
        extensions: string[];
        filenames: string[];
        dependencies: string[];
        absent_dependencies: string[];
        shebangs: string[];
        runtimes: (typeof JAVASCRIPT_RUNTIMES)[number][];
        tags: string[];
        paths: string[];
        project_files: string[];
    };
    files: Pick<ParsedManifest['detect'], 'extensions' | 'filenames' | 'tags' | 'paths'> & {
        languages: boolean;
        prettier_plugins: boolean;
        eslint_plugins: boolean;
        kinds: FileKind[];
    };
    tools: (string | ToolDeclaration)[];
    toolFiles: ({
        source?: string | undefined;
        level?: Level | undefined;
        /** Where gspot writes the file, from the repository root, or from the scope for a root file. */
        target: string;
        /** The path that the manifest names: inside the folder of the configuration, or in the scope for a root file. */
        file: string;
        /** Whether the file sits in the scope folder instead of the folder of its configuration. */
        root: boolean;
        tool: string[];
        check: string[];
        required_tools: string[];
        pointer?:
            | {
                  path: string;
                  when?: { configuration: string } | undefined;
                  folders?: string[] | undefined;
                  body?: string | undefined;
                  /** A line for the header of the pointer, after the tool file path. */
                  note?: string | undefined;
                  /** A scope that shares the tool file of the root uses the root pointer, because the tool reads the nearest one. */
                  inherit?: boolean | undefined;
              }
            | undefined;
        per_scope: boolean;
        when?: { configuration: string } | undefined;
        /** Rule ID prefixes of a Semgrep pack that stay only when the scope depends on one of the packages. */
        rule_dependencies?: Record<string, string[]> | undefined;
        /** The setting that names the folder each rule of a Semgrep pack covers, in every scope with this configuration. */
        rule_paths_setting?: string | undefined;
    } & (
        | { source: string }
        | {
              source?: undefined;
              pointer: {
                  path: string;
                  folders: string[];
                  body?: string | undefined;
                  note?: string | undefined;
                  when?: { configuration: string } | undefined;
              };
          }
    ))[];
    checks: ParsedCheck[];
    naming?: { override: (NamingOverride & { reason: string })[] } | undefined;
    rules: Record<string, ParsedManifest['detect']>;
    ruff: { recommended: string[]; all: string[] };
};

export type ToolFileDeclaration = ParsedManifest['toolFiles'][number];

/** A validated check declaration. Repository commands need no reference example. */
export type CheckDeclaration = Omit<ParsedCheck, 'example'> & {
    example?: string;
};

/** One [[check]] record as written. */
export type ParsedCheck = {
    name: string;
    level: Level;
    stage: Stage;
    runs: (typeof CHECK_RUNS)[number];
    command?: string[] | undefined;
    generator_outputs?: { kind: 'path' | 'pattern' | 'stdout'; path: string }[] | undefined;
    run_in_copy?: boolean | undefined;
    env?: Record<string, string> | undefined;
    fix?: string[] | undefined;
    exit_codes?: number[] | undefined;
    instead_of?: string | undefined;
    when?: Optional<Pick<ConditionFields, 'configuration' | 'setting' | 'git' | 'dependencies' | 'tags'>> | undefined;
    crash_pattern?: string | undefined;
    /** Settings outside tools.<tool> that change what the check reports, for gspot explain. */
    settings?: string[] | undefined;
    needs?: (typeof CHECK_NEEDS)[number][] | undefined;
    operating_systems?: (typeof OPERATING_SYSTEMS)[number]['name'][] | undefined;
    tool?: string | undefined;
    other_tools?: string[];
    files?: ParsedManifest['files'] | undefined;
    output: OutputSpec;
    cwd?: (typeof CHECK_WORKING_FOLDERS)[number] | undefined;
    summary: string;
    example: string;
    why: string;
    help: string;
};

export type ManifestDeclaration = Omit<ParsedManifest, 'checks'> & {
    checks: CheckDeclaration[];
    folder: string;
};

/** A manifest with the full declaration of each named tool. */
export type Manifest = Omit<ManifestDeclaration, 'tools'> & { tools: ToolDeclaration[] };

/** Public check identity and the configuration that ships its behavior. */
export type ConfigurationCheck = { check: CheckDeclaration; configuration: Manifest };

/** A configuration name and its exact written settings location. */
export type ConfigurationDeclaration = { name: string; path: KeyPath };

/** An unknown name keeps the fields of its original declaration. */
export type UnknownConfiguration<Declaration extends Pick<ConfigurationDeclaration, 'name'>> = Declaration & {
    message: string;
};

/** A pinned package installed in the npm or Python tool project. */
export type ToolProjectPackage = {
    kind: Exclude<InstalledToolFolder, 'vale'>;
    name: string;
    version: string;
    requires?: readonly string[];
};

/** One tool pin as mise reads it: the version and backend options. */
export type MisePin = {
    name: string;
    version: string;
    options?: Record<string, string | number | boolean>;
};

/** A tool project installation gspot writes whole: the npm tools, Python environment, or Vale packages. */
export type InstalledToolFolder = (typeof TOOL_FOLDER_KINDS)[number];

/** The level of a check, a rule, or all settings. */
export type Level = (typeof LEVELS)[number];

/** Requirements of the generated npm and Python tool projects. */
export type ToolProjectPins = { npm: Record<string, string>; python: string[] };

/** Default lint rules that run only at level all. */
export type EslintAllRules = Set<string>;

export type InstallerPin = {
    name: string;
    version?: string | undefined;
    options?: Record<string, string | boolean> | undefined;
};

/** Resolved tool metadata derives from the validated manifest; installer declarations become named pins. */
export type ToolDeclaration = {
    installers: Record<string, InstallerPin>;
    name: string;
    install_hint?: string;
    kind: (typeof TOOL_KINDS)[number];
    version?: string;
    min_version?: string;
    system?: boolean;
    builds?: (typeof TOOL_BUILDS)[number][];
    version_command?: string[];
    version_exit_code?: number;
    version_pattern?: string;
    crash_pattern?: string;
    finding_header_pattern?: string;
    rule_url?: string;
    rule_prefix?: string;
    suppression?: {
        marker: string;
        reason: string;
        inline_marker?: string | undefined;
        forbidden?: boolean | undefined;
        example?: string | undefined;
    };
    env?: Record<string, string>;
    refused_options?: { paths: string[]; message: string }[];
    prettier?: {
        entry: string;
        extensions: string[];
        overrides: { files: string; options: Record<string, unknown> }[];
    };
    eslint?: { extensions: string[] };
    requires?: string[];
    when?: Optional<Pick<ConditionFields, 'setting' | 'level'>>[];
    replace?: string[];
    replace_key?: (
        | { file: string; table?: string | undefined; key?: string | undefined; pointer?: false | undefined }
        | { file: 'package.json'; key: string; pointer: true; table?: string | undefined }
    )[];
};

export type Stage = (typeof STAGES)[number];
export type GeneratorOutput = NonNullable<CheckDeclaration['generator_outputs']>[number];

/** Manifest conditions before each consumer selects its supported fields. */
export type ConditionFields = Pick<
    ParsedManifest['detect'],
    'dependencies' | 'absent_dependencies' | 'filenames' | 'tags' | 'runtimes'
> & { configuration: string; level: Level; setting: string; git: true };

/** Tool fields before consumers resolve installer names and omitted values. */
export type ToolFields = Pick<ToolDeclaration, 'name' | 'kind'> &
    Optional<Omit<ToolDeclaration, 'name' | 'kind' | 'installers'>> &
    Optional<Record<'npm' | 'pypi' | 'brew' | 'apt' | 'cargo' | 'github' | 'winget' | 'scoop', InstallerInput>> & {
        mise?: string | (Exclude<InstallerInput, string> & Pick<InstallerPin, 'options'>) | undefined;
    };

/** File matcher keys before consumers fill empty lists and Boolean defaults. */
export type FileMatchInput = Optional<ParsedManifest['files']>;
/** Detection keys before consumers fill absent lists. */
export type DetectionInput = Optional<ParsedManifest['detect']>;
/** Check paths before consumers write their discriminator and command defaults. */
export type CheckDeclarationInput = Omit<
    ParsedCheck,
    'runs' | 'tool' | 'other_tools' | 'generator_outputs' | 'files' | 'output'
> & {
    output?: OutputInput | undefined;
    runs?: ParsedCheck['runs'] | undefined;
    tool?: string | string[] | undefined;
    generator_outputs?: ({ path: string } | { pattern: string } | { stdout: string })[] | undefined;
    files?: FileMatchInput | undefined;
};
/** Tool-file consumers and omitted defaults before consumers resolve their source. */
export type ToolFileInput = Pick<ToolFileDeclaration, 'target'> &
    Optional<Omit<ToolFileDeclaration, 'target' | 'tool' | 'check' | 'source' | 'file'>> & {
        tool?: string | string[] | undefined;
        check?: string | string[] | undefined;
    };
/** Manifest fields before consumers write defaults and public list names. */
export type ManifestInput = Optional<
    Omit<
        ParsedManifest,
        | 'configuration'
        | 'eslint'
        | 'shared_prefixes'
        | 'detect'
        | 'files'
        | 'tools'
        | 'toolFiles'
        | 'checks'
        | 'naming'
        | 'rules'
        | 'ruff'
    >
> & {
    eslint?:
        | (Optional<Omit<ParsedManifest['eslint'], 'all_level_rules'>> & { all_level_rules?: string[] | undefined })
        | undefined;
    shared_prefixes?: Optional<ParsedManifest['shared_prefixes']> | undefined;
    configuration: Omit<ParsedManifest['configuration'], 'requires' | 'suggests' | 'always_selected'> &
        Optional<Pick<ParsedManifest['configuration'], 'requires' | 'suggests' | 'always_selected'>>;
    detect?: DetectionInput | undefined;
    files?: FileMatchInput | undefined;
    tool?: ({ name: string } | ToolInput)[] | undefined;
    tool_file?: ToolFileInput[] | undefined;
    check?: CheckDeclarationInput[] | undefined;
    naming?: Optional<NonNullable<ParsedManifest['naming']>> | undefined;
    rules?: Record<string, Optional<Omit<ConditionFields, 'configuration' | 'level' | 'setting' | 'git'>>> | undefined;
    ruff?: Optional<ParsedManifest['ruff']> | undefined;
};
/** Installer declarations before each installer receives a canonical name. */
export type ToolInput = Omit<ToolFields, 'kind' | 'prettier' | 'when'> & {
    kind?: ToolFields['kind'] | undefined;
    prettier?:
        | (Pick<NonNullable<ToolFields['prettier']>, 'entry'> &
              Optional<Omit<NonNullable<ToolFields['prettier']>, 'entry'>>)
        | undefined;
    when?: NonNullable<ToolFields['when']>[number] | ToolFields['when'];
};
