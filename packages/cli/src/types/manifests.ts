import type { z } from 'zod';

import type { GROUPS, PATH_ROLES, REASON_DESCRIPTIONS, SETTING_TYPES } from '#cli/config/manifests.ts';
import type { outputSchema } from '#cli/schemas/manifests/checks.ts';
import type { checkSchema, manifestSchema } from '#cli/schemas/manifests/manifest.ts';
import type { KeyPath } from '#cli/types/parsers.ts';

export type ShippedRule = {
    source: string;
    path: string;
    group: Configuration['group'];
};

export type LimitCheck = { check: string; languages: readonly string[]; limits: readonly string[] };

export type ManifestSource = { folder: string; text: string };

export type ParsedManifest = z.infer<typeof manifestSchema>;

export type Config = ParsedManifest['configs'][number];

export type Group = (typeof GROUPS)[number];

export type Check = Omit<z.infer<typeof checkSchema>, 'example' | 'name' | 'output'> & {
    id: string;
    example?: string;
    output: z.output<typeof outputSchema>;
};

export type Configuration = Omit<ParsedManifest, 'tools' | 'configuration' | 'checks'> &
    ParsedManifest['configuration'] & { tools: Tool[]; checks: Check[] };

export type ConfigurationCheck = { check: Check; configuration: Configuration };

export type WrittenConfiguration = { name: string; path: KeyPath };

type InstallerPin = {
    name: string;
    version?: string | undefined;
    options?: Record<string, string | boolean> | undefined;
    checksums?: Record<string, string> | undefined;
};

export type VersionedInstaller = InstallerPin & { version: string };

type MiseInstaller = VersionedInstaller & { checksums: Record<string, string> };

export type ToolInstallers = Record<string, InstallerPin> & { pypi?: VersionedInstaller; mise?: MiseInstaller };

export type Tool = Exclude<ParsedManifest['tools'][number], string>;

export type ConfigurationReference = Configuration & {
    selection: { conditions: string[]; exclusions: string[]; requiredBy: string[] };
    ruleFiles: Array<{ path: string; conditions: string[]; exclusions: string[] }>;
    installedTools: Array<{ name: string; version: string | undefined; source: string }>;
    settings: Setting[];
};

export type ReasonRequirement = keyof typeof REASON_DESCRIPTIONS;

export type Setting = {
    name: string;
    type: (typeof SETTING_TYPES)[number];
    path_role?: (typeof PATH_ROLES)[number];
    default?: unknown;
    default_all?: unknown;
    language_defaults?: Record<string, unknown>;
    reason_for?: ReasonRequirement;
    reason_values?: boolean;
    reasoned?: boolean;
    description: string;
    languages?: string[];
};
