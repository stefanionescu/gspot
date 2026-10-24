import type { CheckOutput } from '#cli/types/runs/output.ts';
import type { FileKind } from '#cli/types/repository/files.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { type Optional, type JsonValue } from '#cli/types/shapes.ts';
import type { NamingOverride } from '#cli/types/checks/general/naming.ts';
import type { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';
import type { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/projects/dependencies.ts';

import {
    type LEVELS,
    type STAGES,
    type GROUPS,
    type TOOL_KINDS,
    type CHECK_RUNS,
    type TOOL_BUILDS,
    type CHECK_NEEDS,
    type TOOL_FOLDER_KINDS,
    type CHECK_WORKING_FOLDERS,
} from '#cli/config/configurations/names.ts';

type ConfigFilePointer = {
    path: string;
    folders?: string[] | undefined;
    body: string;
    note?: string | undefined;
    inherit?: boolean | undefined;
};

export type RequirementWalk = {
    configurations: Map<string, Configuration>;
    errors: string[];
    order: Configuration[];
    seen: Set<string>;
};

export type ParsedManifest = {
    folder: string;
    defaults: Record<string, JsonValue>;
    eslint: {
        all_level_rules: Set<string>;
        selectors: { selector: string; message: string; level: Level; paths_setting?: string | undefined }[];
        rules_off: { rules: string[]; reason: string; files?: string[] | undefined }[];
        required_tools: string[];
    };
    shared_prefixes: { prefixes: string[]; kinds: string[] };
    ignored_paths: string[];
    route_files: string[];
    generated: string[];
    allowed_words: string[];
    configuration: {
        name: string;
        group: Group;
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
    tools: (string | Tool)[];
    configFiles: ConfigFile[];
    checks: Check[];
    naming?: { override: (NamingOverride & { reason: string })[] } | undefined;
    rules: Record<string, ParsedManifest['detect']>;
    ruff: { recommended: string[]; all: string[] };
};

export type ConfigFile = {
    source?: string | undefined;
    level?: Level | undefined;
    target: string;
    file: string;
    root: boolean;
    tool: string[];
    check: string[];
    pointer?: ConfigFilePointer | undefined;
    per_scope: boolean;
    rule_dependencies?: Record<string, string[]> | undefined;
    paths_setting?: string | undefined;
} & (
    | { source: string }
    | {
          source?: undefined;
          pointer: ConfigFilePointer & { folders: string[] };
      }
);

export type Check = Omit<ParsedCheck, 'example' | 'name'> & {
    id: string;
    example?: string;
};

export type ParsedCheck = {
    name: string;
    level: Level;
    stage: Stage;
    runs: (typeof CHECK_RUNS)[number];
    command?: string[] | undefined;
    coverage_arguments?: string[] | undefined;
    generator_outputs?: { kind: 'path' | 'pattern' | 'stdout'; path: string }[] | undefined;
    run_in_copy?: boolean | undefined;
    env?: Record<string, string> | undefined;
    fix?: string[] | undefined;
    exit_codes?: number[] | undefined;
    instead_of?: string | undefined;
    when?: Optional<Pick<ConditionFields, 'configuration' | 'setting' | 'git' | 'dependencies' | 'tags'>> | undefined;
    needs?: (typeof CHECK_NEEDS)[number][] | undefined;
    operating_systems?: (typeof OPERATING_SYSTEMS)[number]['name'][] | undefined;
    tool?: string | undefined;
    other_tools?: string[];
    files?: ParsedManifest['files'] | undefined;
    output: CheckOutput;
    cwd?: (typeof CHECK_WORKING_FOLDERS)[number] | undefined;
    summary: string;
    example: string;
    why: string;
    help: string;
};

export type Configuration = Omit<ParsedManifest, 'tools' | 'configuration'> &
    ParsedManifest['configuration'] & { tools: Tool[] };

export type ScopeCheck = { check: Check; configuration?: Configuration | undefined };

export type ConfigurationCheck = ScopeCheck & { configuration: Configuration };

export type WrittenConfiguration = { name: string; path: KeyPath };

export type ToolProjectPackage = {
    kind: Exclude<ToolFolderKind, 'vale'>;
    name: string;
    version: string;
    requires?: readonly string[];
};

export type MisePin = {
    name: string;
    version: string;
    options?: Record<string, string | number | boolean>;
};

export type ToolFolderKind = (typeof TOOL_FOLDER_KINDS)[number];

export type Level = (typeof LEVELS)[number];

export type ToolProjectPins = { npm: Record<string, string>; python: string[] };

export type InstallerPin = {
    name: string;
    version?: string | undefined;
    options?: Record<string, string | boolean> | undefined;
};

export type Tool = {
    installers: Record<string, InstallerPin>;
    name: string;
    install_help?: string;
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
        separator?: string | undefined;
        all_rules?: string | undefined;
        limit_rules?: string | undefined;
        reason: string;
        inline_marker?: string | undefined;
        forbidden?: boolean | undefined;
        example?: string | undefined;
    };
    prettier?: {
        module: string;
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

export type Group = (typeof GROUPS)[number];

export type Stage = (typeof STAGES)[number];
export type GeneratorOutput = NonNullable<Check['generator_outputs']>[number];

export type ConditionFields = Pick<
    ParsedManifest['detect'],
    'dependencies' | 'absent_dependencies' | 'filenames' | 'tags' | 'runtimes'
> & { configuration: string; level: Level; setting: string; git: true };

export type NameList = { package: string; version: string; source: string; names: string[] };
