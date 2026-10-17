import type { JSONSchema } from 'zod/v4/core';
import type { SettingDeclaration } from '#cli/types/settings/tables.ts';
import type { Manifest, ConfigurationCheck } from '#cli/types/configurations.ts';

/** The public help of one command, without Commander runtime objects. */
export type CommandReference = {
    name: string;
    summary: string;
    description: string;
    usage: string;
    arguments: { name: string; description: string; required: boolean; choices?: string[]; default?: unknown }[];
    options: { flags: string; description: string; choices?: string[]; default?: unknown }[];
    exitCodes: string;
    example: string;
};

/** A setting declaration and the configurations with the same defaults. */
export type SettingVariant = { setting: SettingDeclaration; owners: string[] };

/** Plain data read by the documentation build. */
export type ReferenceData = {
    commands: CommandReference[];
    configurations: Manifest[];
    checks: ConfigurationCheck[];
    settings: SettingVariant[];
    schema: JSONSchema.JSONSchema;
    schemaFile: string;
    version: string;
    styles: { extractor: RegExp; tokenEnd: string; pseudoClasses: RegExp };
    groups: Record<string, string>;
    ruleFiles: Record<string, string[]>;
    configurationSettings: Record<string, SettingDeclaration[]>;
};
