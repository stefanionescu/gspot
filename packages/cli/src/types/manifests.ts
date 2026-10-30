import type { z } from 'zod';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { checkSchema, manifestSchema } from '#cli/schemas/manifests/manifest.ts';
import { type LEVELS, type STAGES, type GROUPS } from '#cli/config/manifests/names.ts';
import type { namingOverrideSchema, namingDefaultsSchema } from '#cli/schemas/manifests/manifests.ts';

export type RequirementWalk = {
    configurationsByName: Map<string, Configuration>;
    errors: string[];
    order: Configuration[];
    seen: Set<string>;
};

export type ParsedManifest = z.infer<typeof manifestSchema>;

export type ConfigFile = ParsedManifest['configFiles'][number];

export type SourcedConfigFile = Extract<ConfigFile, { source: string }>;

export type Check = Omit<z.infer<typeof checkSchema>, 'example' | 'name'> & {
    id: string;
    example?: string;
};

export type Configuration = Omit<ParsedManifest, 'tools' | 'configuration' | 'checks'> &
    ParsedManifest['configuration'] & { tools: Tool[]; checks: Check[] };

export type ScopeCheck = { check: Check; configuration?: Configuration | undefined };

export type ConfigurationCheck = ScopeCheck & { configuration: Configuration };

export type WrittenConfiguration = { name: string; path: KeyPath };

export type ToolProjectPackage = {
    kind: Exclude<ToolFolderKind, 'vale'>;
    name: string;
    version: string;
    requires?: readonly string[];
};

export type MiseToolPin = {
    name: string;
    version: string;
    options?: Record<string, string | number | boolean> | undefined;
    checksums?: Record<string, string> | undefined;
};

export type ToolFolderKind = 'npm' | 'python' | 'vale';

export type Level = (typeof LEVELS)[number];

export type ToolProjectPins = { npm: Record<string, string>; python: string[] };

type InstallerPin = {
    name: string;
    version?: string | undefined;
    options?: Record<string, string | boolean> | undefined;
    checksums?: Record<string, string> | undefined;
};

export type VersionedInstaller = InstallerPin & { version: string };

export type ToolInstallers = Record<string, InstallerPin> & { pypi?: VersionedInstaller; mise?: VersionedInstaller };

export type Tool = Exclude<ParsedManifest['tools'][number], string>;

export type Group = (typeof GROUPS)[number];

export type Stage = (typeof STAGES)[number];
export type GeneratorOutput = NonNullable<Check['generator_outputs']>[number];

export type PathContainer = NamingDefaults['path_containers'][number];

export type NamingDefaults = z.infer<typeof namingDefaultsSchema>;

export type NamingOverride = z.infer<typeof namingOverrideSchema>;
