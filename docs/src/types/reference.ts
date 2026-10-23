import type { JSONSchema } from 'zod/v4/core';
import type { Setting } from '#cli/types/settings/inheritance.ts';
import type { Configuration, ConfigurationCheck } from '#cli/types/configurations.ts';

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

export type CliReference = {
    commands: CommandReference[];
    configurations: Configuration[];
    checks: ConfigurationCheck[];
    settings: SettingVariant[];
    schema: JSONSchema.JSONSchema;
    ruleFiles: Record<string, string[]>;
    configurationSettings: Record<string, Setting[]>;
};

export type ReferencePage = {
    data: {
        title: string;
        description: string;
        editUrl: false;
        tableOfContents?: { maxHeadingLevel: number };
    };
    body: string;
};

export type PluginRule = { name: string; link: string; configs: string[]; summary: string };

export type GuideCheck = { name: string; link: string; stage: string; summary: string };
