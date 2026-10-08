import type { z } from 'zod';
import type { ToolPin } from '#cli/types/parsers/tool.ts';
import type { Defined } from '#cli/types/platform/runtime.ts';
import type { KeyPath } from '#cli/types/parsers/document.ts';
import type { levelSchema } from '#cli/parsers/schema/contracts.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { INSTALLATION_KINDS } from '#cli/config/configurations.ts';
import type { manifestSchema } from '#cli/parsers/schema/configurations.ts';

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
    errors: string[];
    order: Manifest[];
    seen: Set<string>;
    visiting: string[];
};

export type CheckRule = { applies: (check: ParsedCheck) => boolean; error: (check: ParsedCheck) => string };

/** manifest.toml as the schema accepts it. */
export type ParsedManifest = z.infer<typeof manifestSchema>;

export type ExecutionFields<Check> = Check extends unknown ? Omit<Check, 'example'> : never;

export type ToolFileDeclaration = ParsedManifest['toolFiles'][number];

/** A complete generated file, with its Eta source resolved by the manifest schema. */
export type GeneratedToolFile = Extract<ToolFileDeclaration, { fragment: false }>;

/** Validated execution variants. Repository-defined commands do not require titles or reference examples. */
export type CheckDeclaration = Omit<ExecutionFields<Defined<ParsedCheck>>, 'title'> & {
    title?: string;
    example?: string;
};

/** One [[check]] entry as written. */
export type ParsedCheck = ParsedManifest['checks'][number];

export type SettingDeclaration = Defined<ParsedManifest['settings'][number]>;

export type FileMatch = ParsedManifest['files'];

export type ManifestDeclaration = Omit<ParsedManifest, 'checks' | 'settings'> & {
    checks: CheckDeclaration[];
    settings: SettingDeclaration[];
    dir: string;
};

/** A registry entry whose named tool references have been resolved. */
export type Manifest = Omit<ManifestDeclaration, 'tools'> & { tools: ToolPin[] };

/** The process-owned cache of shipped configuration declarations. */
export type ManifestCache = { cache: Map<string, Manifest> | undefined };

/** Public check identity and the configuration that ships its behavior. */
export type OwnedCheck = { check: CheckDeclaration; configuration: Manifest };
/** The declaration meaning compared across configuration owners. */
export type SettingMeaning = { configuration: string; meaning: Record<string, unknown> };

/** Configuration choices declared at the root and in project scopes. */
export type ConfigurationSelection = {
    configurations: string[];
    scope: Record<string, { configurations: string[]; removed_configurations: string[] }>;
    removed_configurations: string[];
};
/** Resolved configuration choices consumed without their scope's policy values. */
export type SelectedConfigurations = { selected: Manifest[] };
/** A detected configuration absent from the saved selection, with its install command. */
export type ConfigurationSuggestion = { configuration: string; evidence: string; command: string };

/** Repository evidence with an optional count for extension matches. */
export type DetectionEvidence = { evidence: string; count?: number };

/** A configuration name and its exact authored policy location. */
export type ConfigurationDeclaration = { name: string; path: KeyPath };

/** An unknown name retains the fields of its original declaration. */
export type UnknownConfiguration<Declaration extends Pick<ConfigurationDeclaration, 'name'>> = Declaration & {
    message: string;
};

/** The configuration responsible for one declared installation version. */
export type PinRequirement = { version: string; owner: string };

/** A pinned package installed in the npm or Python tool project. */
export type ToolProjectPackage = { kind: InstallationKind; name: string; version: string };

/** One tool pin as mise reads it: the version, the operating systems that have a build, and backend options. */
export type MisePin = {
    name: string;
    version: string;
    os?: string[];
    options?: Record<string, string | number | boolean>;
};

/** A tool project installation gspot writes whole: the npm tools or the Python environment. */
export type InstallationKind = (typeof INSTALLATION_KINDS)[number];

/** A declared mise installer and its backend prefix. */
export type MiseBackend = { installer: string; prefix: string };

/** The level of a check, a rule, or the whole policy. */
export type Level = z.output<typeof levelSchema>;

/** A rule asset and its path inside the rules folder before selection. */
export type RuleSource = { source: string; path: string };
