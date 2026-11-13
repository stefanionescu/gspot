import type { z } from 'zod';

import type { GROUP_LABELS } from '#cli/config/commands/setup.ts';
import type { GLOBAL_OPTIONS, PROGRAM_EXIT_CODES } from '#cli/config/main.ts';
import type { RELEASE_AGE_VERSIONS } from '#cli/config/tools/installers.ts';
import type { CheckDescription } from '#cli/types/engine/plan.ts';
import type { Configuration, ConfigurationCheck, RuleFileReference, Tool } from '#cli/types/manifests.ts';
import type { SetupReference } from '#cli/types/repository.ts';
import type { Level, Setting, SettingReference } from '#cli/types/settings.ts';
import type { RuleExplanations } from '#cli/types/tools.ts';

export type CommandHelp = {
    summary: string;
    group: string;
    description: string;
    arguments: Readonly<Record<string, string>>;
    options: Readonly<Record<string, string>>;
    exitCodes: ReadonlyArray<readonly [string, string]>;
    example: string;
};

export type CommandReference = {
    name: string;
    summary: string;
    description: string;
    usage: string;
    arguments: Array<{ name: string; description: string; required: boolean; choices?: string[]; default?: unknown }>;
    options: Array<{ flags: string; description: string; choices?: string[]; default?: unknown }>;
    exitCodes: ReadonlyArray<readonly [codes: string, meaning: string]>;
    example: string;
};

export type ConfigurationReference = Configuration & {
    selection: { conditions: string[]; exclusions: string[]; requiredBy: string[] };
    ruleFiles: RuleFileReference[];
    installedTools: Array<{ name: string; version: string | undefined; source: string }>;
    settings: Setting[];
};

type CheckReference = ConfigurationCheck & CheckDescription & { explanations: RuleExplanations | undefined };

export type CliReference = {
    groups: typeof GROUP_LABELS;
    commands: CommandReference[];
    globalOptions: typeof GLOBAL_OPTIONS;
    exitCodes: typeof PROGRAM_EXIT_CODES;
    configurations: ConfigurationReference[];
    checks: CheckReference[];
    settings: SettingReference[];
    schema: z.core.JSONSchema.JSONSchema;
    setup: SetupReference[];
    hookProgramMissing: string;
    runtimeMinimums: { node: string };
    packageManagerMinimums: typeof RELEASE_AGE_VERSIONS;
    levelSummaries: Record<Level, string>;
    allLevelTools: string[];
    yarnClassicInstall: string;
    cloneInstalls: Array<{ lockfile: string; note: string | undefined; command: string }>;
    suppressions: Array<{ name: string; form: NonNullable<Tool['suppression']> }>;
};

export type InvalidValue = { option: string | undefined; value: string; detail: string };
