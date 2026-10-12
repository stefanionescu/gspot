import type { JsonValue } from '#cli/types/parsers/json.ts';
import type { Defined, Optional } from '#cli/types/objects.ts';
import type { NamingOverride } from '#cli/types/checks/general.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { FileKind } from '#cli/types/repository/inventory.ts';
import type { TOOL_FOLDER_KINDS } from '#cli/config/system/locations.ts';
import type { OutputSpec, OutputInput } from '#cli/types/parsers/output.ts';
import type { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependency-files.ts';

import type {
    LEVELS,
    STAGES,
    GROUPS,
    TOOL_KINDS,
    CHECK_RUNS,
    TOOL_BUILDS,
    CHECK_NEEDS,
    CHECK_WORKING_DIRECTORIES,
} from '#cli/config/configurations.ts';

type NativeInstaller = string | Defined<Required<Pick<InstallerPin, 'name' | 'version'>>>;

export type SelectionWalk = {
    manifests: Map<string, Manifest>;
    errors: string[];
    order: Manifest[];
    seen: Set<string>;
};

/** manifest.toml as the schema accepts it. */
export type ParsedManifest = {
    defaults: Record<string, JsonValue>;
    route_files: string[];
    eslint: {
        presets: Record<string, { package: string; source: string }>;
        all_level_rules: EslintAllRules;
        selectors: {
            selector: string;
            message: string;
            files?: string[] | undefined;
            role?: string | undefined;
            allowed?: string | undefined;
            ignores?: string[] | undefined;
            when?: Pick<ConditionFields, 'setting' | 'value'> | undefined;
        }[];
        rules_off: {
            rules: string[];
            reason: string;
            files?: string[] | undefined;
            when?: Pick<ConditionFields, 'setting' | 'value'> | undefined;
        }[];
    };
    prefix_collisions: { prefixes: string[]; kinds: string[] };
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
        when?: { git: boolean } | undefined;
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
        target: string;
        tool: string[];
        check: string[];
        required_tools: string[];
        rule_keys?: string[] | undefined;
        pointer?:
            | {
                  path: string;
                  when?: { configuration: string } | undefined;
                  directories?: string[] | undefined;
                  body?: string | undefined;
              }
            | undefined;
        scope_fragments: boolean;
        per_scope: boolean;
        when?: { configuration: string } | undefined;
    } & ({ fragment: true } | { fragment: false; source: string }))[];
    checks: ParsedCheck[];
    naming?: { override: (NamingOverride & { reason: string })[] } | undefined;
    rules: Record<string, ParsedManifest['detect']>;
    ruff_rules: { recommended: string[]; all: string[] };
};

export type ToolFileDeclaration = ParsedManifest['toolFiles'][number];

/** Validated execution variants. Repository-defined commands do not require reference examples. */
export type CheckDeclaration = Omit<ParsedCheck, 'example'> & {
    example?: string;
};

/** One [[check]] entry as written. */
export type ParsedCheck = {
    name: string;
    level: Level;
    stage: Stage;
    runs: (typeof CHECK_RUNS)[number];
    command?: string[] | undefined;
    generated_paths?: { kind: 'path' | 'pattern' | 'stdout'; path: string }[] | undefined;
    run_in_copy?: boolean | undefined;
    env?: Record<string, string> | undefined;
    fix?: string[] | undefined;
    exit_codes?: number[] | undefined;
    instead_of?: string | undefined;
    when?: Optional<Pick<ConditionFields, 'configuration' | 'setting' | 'git' | 'dependencies'>> | undefined;
    crash_pattern?: string | undefined;
    needs?: (typeof CHECK_NEEDS)[number][] | undefined;
    operating_systems?: ('macos' | 'linux' | 'windows')[] | undefined;
    tool?: string | undefined;
    other_tools?: string[];
    files?: ParsedManifest['files'] | undefined;
    output: OutputSpec;
    cwd?: (typeof CHECK_WORKING_DIRECTORIES)[number] | undefined;
    summary: string;
    example: string;
    why: string;
    help: string;
};

export type ManifestDeclaration = Omit<ParsedManifest, 'checks'> & {
    checks: CheckDeclaration[];
    dir: string;
};

/** A registry entry with complete declarations for each named tool reference. */
export type Manifest = Omit<ManifestDeclaration, 'tools'> & { tools: ToolDeclaration[] };

/** Public check identity and the configuration that ships its behavior. */
export type ConfigurationCheck = { check: CheckDeclaration; configuration: Manifest };

/** A configuration name and its exact written settings location. */
export type ConfigurationDeclaration = { name: string; path: KeyPath };

/** An unknown name retains the fields of its original declaration. */
export type UnknownConfiguration<Declaration extends Pick<ConfigurationDeclaration, 'name'>> = Declaration & {
    message: string;
};

/** The configuration responsible for one declared installation version. */
export type PinRequirement = { version: string; owner: string };

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
export type ToolProjectPins = { npm: Record<string, string>; python: string[]; constraints: string[] };

/** Default rules active only at level all. */
export type EslintAllRules = Set<string>;

export type InstallerPin = {
    name: string;
    version?: string | undefined;
    options?: Record<string, string | boolean> | undefined;
    constraints?: string[] | undefined;
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
    diagnostic_header_pattern?: string;
    rule_url?: string;
    rule_prefix?: string;
    suppression?: {
        marker: string;
        reason: string;
        inline_marker?: string | undefined;
        forbidden?: boolean | undefined;
    };
    env?: Record<string, string>;
    refused_options?: { paths: string[]; message: string; values?: (string | number | boolean)[] | undefined }[];
    query_packs?: Record<string, string>;
    prettier?: {
        entry: string;
        extensions: string[];
        overrides: { files: string; options: Record<string, unknown> }[];
    };
    eslint?: { extensions: string[] };
    requires?: string[];
    when?: Optional<Pick<ConditionFields, 'setting' | 'level'>>[];
    replace?: (
        | {
              file: string;
              shared: boolean;
              table?: string | undefined;
              key?: string | undefined;
              redirect?: false | undefined;
          }
        | { shared: boolean; file: 'package.json'; key: string; redirect: true; table?: string | undefined }
    )[];
};

export type Stage = (typeof STAGES)[number];
export type GeneratedPath = NonNullable<CheckDeclaration['generated_paths']>[number];

/** Native manifest conditions before each consumer selects its supported fields. */
export type ConditionFields = Pick<
    ParsedManifest['detect'],
    'dependencies' | 'absent_dependencies' | 'filenames' | 'tags' | 'runtimes'
> & { configuration: string; level: Level; setting: string; value: string | number | boolean; git: boolean };

/** Native tool fields before consumers resolve installer names and omitted values. */
export type ToolFields = Pick<ToolDeclaration, 'name' | 'kind'> &
    Optional<Omit<ToolDeclaration, 'name' | 'kind' | 'installers'>> &
    Optional<Record<'npm' | 'brew' | 'apt' | 'cargo' | 'github' | 'winget' | 'scoop', NativeInstaller>> & {
        pypi?: string | (Exclude<NativeInstaller, string> & Pick<InstallerPin, 'constraints'>) | undefined;
        mise?: string | (Exclude<NativeInstaller, string> & Pick<InstallerPin, 'options'>) | undefined;
    };

/** File matcher keys before consumers fill empty lists and Boolean defaults. */
export type FileMatchInput = Optional<ParsedManifest['files']>;
/** Detection keys before consumers fill absent lists. */
export type DetectionInput = Optional<ParsedManifest['detect']>;
/** Native check paths before consumers write their discriminator and command defaults. */
export type CheckInput = Omit<ParsedCheck, 'runs' | 'tool' | 'other_tools' | 'generated_paths' | 'files' | 'output'> & {
    output?: OutputInput | undefined;
    runs?: ParsedCheck['runs'] | undefined;
    tool?: string | string[] | undefined;
    generated_paths?: ({ path: string } | { pattern: string } | { stdout: string })[] | undefined;
    files?: FileMatchInput | undefined;
};
/** Tool-file consumers and omitted defaults before consumers resolve their source. */
export type ToolFileInput = Pick<ToolFileDeclaration, 'target'> &
    Optional<Omit<ToolFileDeclaration, 'target' | 'tool' | 'check'>> & {
        tool?: string | string[] | undefined;
        check?: string | string[] | undefined;
    };
/** Native manifest fields before consumers write defaults and public list names. */
export type ManifestInput = Optional<
    Omit<
        ParsedManifest,
        | 'configuration'
        | 'eslint'
        | 'prefix_collisions'
        | 'detect'
        | 'files'
        | 'tools'
        | 'toolFiles'
        | 'checks'
        | 'naming'
        | 'rules'
        | 'ruff_rules'
    >
> & {
    eslint?:
        | (Optional<Omit<ParsedManifest['eslint'], 'all_level_rules'>> & { all_level_rules?: string[] | undefined })
        | undefined;
    prefix_collisions?: Optional<ParsedManifest['prefix_collisions']> | undefined;
    configuration: Omit<ParsedManifest['configuration'], 'requires' | 'suggests' | 'always_selected'> &
        Optional<Pick<ParsedManifest['configuration'], 'requires' | 'suggests' | 'always_selected'>>;
    detect?: DetectionInput | undefined;
    files?: FileMatchInput | undefined;
    tool?: ({ name: string } | ToolInput)[] | undefined;
    tool_file?: ToolFileInput[] | undefined;
    check?: CheckInput[] | undefined;
    naming?: Optional<NonNullable<ParsedManifest['naming']>> | undefined;
    rules?:
        | Record<string, Optional<Omit<ConditionFields, 'configuration' | 'level' | 'setting' | 'value' | 'git'>>>
        | undefined;
    ruff_rules?: Optional<ParsedManifest['ruff_rules']> | undefined;
};
/** Native installer declarations before each installer receives a canonical name. */
export type ToolInput = Omit<ToolFields, 'kind' | 'prettier' | 'when' | 'replace'> & {
    kind?: ToolFields['kind'] | undefined;
    prettier?:
        | (Pick<NonNullable<ToolFields['prettier']>, 'entry'> &
              Optional<Omit<NonNullable<ToolFields['prettier']>, 'entry'>>)
        | undefined;
    when?: NonNullable<ToolFields['when']>[number] | ToolFields['when'];
    replace?:
        | (
              | {
                    file: string;
                    table?: string | undefined;
                    key?: string | undefined;
                    shared?: boolean | undefined;
                    redirect?: false | undefined;
                }
              | {
                    file: 'package.json';
                    key: string;
                    redirect: true;
                    table?: string | undefined;
                    shared?: boolean | undefined;
                }
          )[]
        | undefined;
};
