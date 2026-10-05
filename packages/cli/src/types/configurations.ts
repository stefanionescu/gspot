import type { z } from 'zod';
import type { Defined } from '#cli/types/platform/runtime.ts';
import type { KeyPath } from '#cli/types/platform/document.ts';
import type { ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';
import type { manifestSchema } from '#cli/parsers/schema/configurations/manifest.ts';
import type { toolSchema, installerPinSchema } from '#cli/parsers/schema/configurations/tool.ts';

export type ConfigurationEvidence = {
    configuration: string;
    evidence: string;
    kind: Manifest['configuration']['kind'];
    count?: number;
};

/** What detection reads from a scope's tree once, for every manifest to look at. */
export type Layout = {
    candidates: TrackedFile[];
    extensionCounts: Map<string, number>;
    shebangs: Set<string>;
    runtimes: Map<string, string>;
    dependencies: Map<string, string>;
    scope: string;
};

export type SelectionWalk = {
    manifests: Map<string, Manifest>;
    problems: string[];
    order: Manifest[];
    seen: Set<string>;
    visiting: string[];
};

export type CheckRule = { applies: (check: RawCheck) => boolean; problem: (check: RawCheck) => string };

export type InstallerPin = z.output<typeof installerPinSchema>;

/** Resolved tool metadata derives from the validated manifest; installer declarations become named pins. */
export type ToolPin = z.output<typeof toolSchema>;

/** manifest.toml as the schema accepts it. */
export type RawManifest = z.infer<typeof manifestSchema>;

export type ExecutionFields<Check> = Check extends unknown ? Omit<Check, 'example'> : never;

export type ConfigurationFile = RawManifest['configs'][number];

/** A complete generated file, with its render template resolved by the manifest schema. */
export type GeneratedConfigurationFile = Extract<ConfigurationFile, { fragment: false }>;

/** Validated execution variants. Repository-defined commands do not require reference examples. */
export type CheckSpec = ExecutionFields<Defined<RawCheck>> & { example?: string };

/** One [[check]] entry as written. */
export type RawCheck = RawManifest['checks'][number];

export type SettingSpec = Defined<RawManifest['settings'][number]>;

export type FileMatch = RawManifest['files'];

export type Manifest = Omit<RawManifest, 'checks' | 'settings'> & {
    checks: CheckSpec[];
    settings: SettingSpec[];
    dir: string;
};

/** The process-owned cache of shipped configuration declarations. */
export type ManifestRegistryState = { cache: Map<string, Manifest> | undefined };

/** Public check identity and the configuration that ships its behavior. */
export type OwnedCheck = { check: CheckSpec; configuration: Manifest };
/** The declaration meaning compared across configuration owners. */
export type SettingMeaning = { configuration: string; meaning: Record<string, unknown> };

/** Configuration choices declared at the root and in project scopes. */
export type ConfigurationSelection = {
    configurations: string[];
    scopes: Pick<ScopeEntry, 'path' | 'configurations'>[];
};
/** Resolved configuration choices consumed without their scope's policy values. */
export type SelectedConfigurations = { selected: Manifest[] };
/** A detected configuration absent from the saved selection, with its acquisition command. */
export type ConfigurationSuggestion = { configuration: string; evidence: string; command: string };

/** Repository evidence with an optional count for extension matches. */
export type DetectionEvidence = { evidence: string; count?: number };

/** A configuration name and its exact authored policy location. */
export type ConfigurationDeclaration = { name: string; path: KeyPath };

/** An unknown name retains the fields of its original declaration. */
export type UnknownConfiguration<Declaration extends Pick<ConfigurationDeclaration, 'name'>> = Declaration & {
    message: string;
};
