import type { z } from 'zod';
import type { LEVELS, GROUPS } from '#cli/config/manifests.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { namingOverrideSchema } from '#cli/schemas/manifests/manifests.ts';
import type { checkSchema, manifestSchema } from '#cli/schemas/manifests/manifest.ts';

export type LimitCheck = { check: string; languages: readonly string[]; limits: readonly string[] };

export type RequirementWalk = {
    configurationsByName: Map<string, Configuration>;
    errors: string[];
    order: Configuration[];
    seen: Set<string>;
};

export type ParsedManifest = z.infer<typeof manifestSchema>;

export type Config = ParsedManifest['configs'][number];

export type SourcedConfig = Extract<Config, { source: string }>;

export type Check = Omit<z.infer<typeof checkSchema>, 'example' | 'name'> & {
    id: string;
    example?: string;
};

export type Configuration = Omit<ParsedManifest, 'tools' | 'configuration' | 'checks'> &
    ParsedManifest['configuration'] & { tools: Tool[]; checks: Check[] };

export type ScopeCheck = { check: Check; configuration?: Configuration | undefined };

export type ConfigurationCheck = ScopeCheck & { configuration: Configuration };

export type WrittenConfiguration = { name: string; path: KeyPath };

export type PackagePin = {
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

export type PackagePins = { npm: Record<string, string>; python: string[] };

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

export type GeneratorOutput = NonNullable<Check['generator_outputs']>[number];

export type PathContainer = NonNullable<Configuration['naming']>['path_containers'][number];

export type NamingOverride = z.infer<typeof namingOverrideSchema>;
