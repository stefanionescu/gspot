import type { z } from 'zod';
import type cliPackage from '#cli-package';
import type { DOCS_PATHS } from '#cli/config/files/names.ts';
import type { STAGE_FILTERS } from '#cli/config/planning.ts';
import type { Setting } from '#cli/types/settings/inheritance.ts';
import type { GROUP_LABELS } from '#cli/config/manifests/names.ts';
import type { START_RUNNERS } from '#cli/config/repository/javascript.ts';
import type { LintRuleDocs } from '#cli/types/executables/executables.ts';
import type { GLOBAL_OPTIONS, PROGRAM_EXIT_CODES } from '#cli/config/main.ts';
import type { Tool, Level, Check, Configuration, ConfigurationCheck } from '#cli/types/manifests.ts';

export type CommandReference = {
    name: string;
    summary: string;
    description: string;
    usage: string;
    arguments: { name: string; description: string; required: boolean; choices?: string[]; default?: unknown }[];
    options: { flags: string; description: string; choices?: string[]; default?: unknown }[];
    exitCodes: readonly (readonly [codes: string, meaning: string])[];
    example: string;
};

export type SettingVariant = { setting: Setting; owners: string[] };

export type SettingAccepted = {
    types: string[];
    choices: { value: unknown; description: string | undefined }[];
    alternatives: SettingAccepted[];
};

export type SettingReference = {
    key: string;
    name: string;
    kind: 'value' | 'table' | 'record';
    required: boolean;
    description: string | undefined;
    default: unknown;
    reasoned: boolean;
    variantOf: string | undefined;
    rootOnly: boolean;
    scopeKeys: string[];
    accepted: SettingAccepted;
    variants: SettingVariant[];
    children: SettingReference[];
};

export type CheckReference = ConfigurationCheck &
    CheckDescription & { ruleDocs: Readonly<Record<string, LintRuleDocs>> | undefined };

export type CheckDescription = {
    toolName: string | undefined;
    tools: string[];
    programs: string[];
    systems: string[] | undefined;
    needs: NonNullable<Check['needs']>;
    minVersions: Record<string, string>;
    turnOff: { paths: string; rule: string | undefined };
    suppression: Tool['suppression'];
};

export type ConfigurationReference = Configuration & {
    selection: { conditions: string[]; exclusions: string[]; requiredBy: string[] };
    ruleFiles: { path: string; conditions: string[]; exclusions: string[] }[];
    installedTools: { name: string; version: string | undefined; source: string }[];
    settings: Setting[];
};

export type SetupReference = {
    name: string;
    label: string;
    start: string;
    add: string;
    prerequisites: string[];
    lines: string[];
    clone: string[];
};

type ReferenceSchema = z.core.JSONSchema.JSONSchema;

export type CliReference = {
    package: typeof cliPackage;
    docs: typeof DOCS_PATHS;
    groups: typeof GROUP_LABELS;
    reportStages: typeof STAGE_FILTERS;
    commands: CommandReference[];
    globalOptions: typeof GLOBAL_OPTIONS;
    exitCodes: typeof PROGRAM_EXIT_CODES;
    configurations: ConfigurationReference[];
    checks: CheckReference[];
    settings: SettingReference[];
    schema: ReferenceSchema;
    setup: SetupReference[];
    runners: typeof START_RUNNERS;
    runtimeMinimums: { node: string; bun: string };
    levelSummaries: Record<Level, string>;
    allLevelTools: string[];
    yarnClassicInstall: string;
    cloneInstalls: { lockfile: string; note: string | undefined; command: string }[];
    suppressions: { name: string; form: NonNullable<Tool['suppression']> }[];
};
