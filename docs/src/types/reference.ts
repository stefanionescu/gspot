import type { GUIDES } from '../config/reference.ts';
import type { Setting } from '#cli/types/settings/inheritance.ts';
import type { buildJsonSchema } from '#cli/settings/json-schema.ts';
import type { Tool, Configuration, ConfigurationCheck } from '#cli/types/configurations.ts';

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
    schema: SettingsSchema;
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

export type SettingsSchema = ReturnType<typeof buildJsonSchema>;

export type GuideSlug = (typeof GUIDES)[keyof typeof GUIDES];

export type Suppression = NonNullable<Tool['suppression']>;
