import type { JSONSchema } from 'zod/v4/core';
import type { Setting } from '#cli/types/settings/inheritance.ts';
import type { Configuration, ConfigurationCheck } from '#cli/types/configurations.ts';

/** The public help of one command, without Commander runtime objects. */
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

/** A setting and the configurations with the same defaults. */
export type SettingVariant = { setting: Setting; owners: string[] };

/** The facts about commands, configurations, checks, and settings that the docs pages read. */
export type CliReference = {
    commands: CommandReference[];
    configurations: Configuration[];
    checks: ConfigurationCheck[];
    settings: SettingVariant[];
    schema: JSONSchema.JSONSchema;
    ruleFiles: Record<string, string[]>;
    configurationSettings: Record<string, Setting[]>;
};

/** A generated reference page and its Starlight frontmatter. */
export type ReferencePage = {
    data: {
        title: string;
        description: string;
        editUrl: false;
        tableOfContents?: { maxHeadingLevel: number };
    };
    body: string;
};

/** One plugin rule on the ESLint plugin page: its name, page, the configs that turn it on, and what it finds. */
export type PluginRule = { name: string; link: string; configs: string[]; summary: string };

/** One check in a guide's table: its ID, page, stage, and summary. */
export type GuideCheck = { name: string; link: string; stage: string; summary: string };
