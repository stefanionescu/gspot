import type { z } from 'zod';
import type { KeyPath } from '#cli/types/parsers.ts';
import type { PATH_ROLES, REASON_DESCRIPTIONS } from '#cli/config/manifests.ts';
import type { checkSchema, manifestSchema } from '#cli/schemas/manifests/manifest.ts';

export type ShippedRule = {
    source: string;
    path: string;
    group: Configuration['group'];
};

export type LimitCheck = { check: string; languages: readonly string[]; limits: readonly string[] };

export type RequirementWalk = {
    configurationsByName: Map<string, Configuration>;
    errors: string[];
    order: Configuration[];
    seen: Set<string>;
};

export type ParsedManifest = z.infer<typeof manifestSchema>;

export type Check = Omit<z.infer<typeof checkSchema>, 'example' | 'name'> & {
    id: string;
    example?: string;
};

export type Configuration = Omit<ParsedManifest, 'tools' | 'configuration' | 'checks'> &
    ParsedManifest['configuration'] & { tools: Tool[]; checks: Check[] };

export type ScopeCheck = { check: Check; configuration?: Configuration | undefined };

export type ConfigurationCheck = ScopeCheck & { configuration: Configuration };

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
    ruleFiles: { path: string; conditions: string[]; exclusions: string[] }[];
    installedTools: { name: string; version: string | undefined; source: string }[];
    settings: Setting[];
};

export type ReasonRequirement = keyof typeof REASON_DESCRIPTIONS;

export type Setting = {
    name: string;
    type: 'number' | 'string' | 'path' | 'boolean' | 'list' | 'table';
    path_role?: (typeof PATH_ROLES)[number];
    default?: unknown;
    default_all?: unknown;
    language_defaults?: Record<string, unknown>;
    reason_when?: ReasonRequirement;
    reason_values?: boolean;
    description: string;
    languages?: string[];
};
