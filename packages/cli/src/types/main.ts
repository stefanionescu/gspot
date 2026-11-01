import type { z } from 'zod';
import type cliPackage from '#cli-package';
import type { LintRuleDocs } from '#cli/types/tools.ts';
import type { DOCS_PATHS } from '#cli/config/manifests.ts';
import type { GROUP_LABELS } from '#cli/config/generation.ts';
import type { SetupReference } from '#cli/types/repository.ts';
import type { CheckDescription } from '#cli/types/engine/plan.ts';
import type { Level, SettingReference } from '#cli/types/settings.ts';
import type { START_RUNNERS } from '#cli/config/repository/javascript.ts';
import type { RELEASE_AGE_VERSIONS } from '#cli/config/tools/installers.ts';
import type { GLOBAL_OPTIONS, PROGRAM_EXIT_CODES } from '#cli/config/main.ts';
import type { Tool, ConfigurationCheck, ConfigurationReference } from '#cli/types/manifests.ts';

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

export type CheckReference = ConfigurationCheck &
    CheckDescription & { ruleDocs: Readonly<Record<string, LintRuleDocs>> | undefined };

type ReferenceSchema = z.core.JSONSchema.JSONSchema;

export type CliReference = {
    package: typeof cliPackage;
    docs: typeof DOCS_PATHS;
    groups: typeof GROUP_LABELS;
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
    packageManagerMinimums: typeof RELEASE_AGE_VERSIONS;
    levelSummaries: Record<Level, string>;
    allLevelTools: string[];
    yarnClassicInstall: string;
    cloneInstalls: { lockfile: string; note: string | undefined; command: string }[];
    suppressions: { name: string; form: NonNullable<Tool['suppression']> }[];
};

export type InvalidValue = { option: string | undefined; value: string; detail: string };
