import type { z } from 'zod';
import type { Defined } from '#types/config.ts';
import type { outputSchema } from '#cli/presets/output-schema.ts';
import type { manifestSchema } from '#cli/presets/manifest-schema.ts';
// The shape of a preset manifest.toml after validation.

type NpmInstallerDefinition = Exclude<NonNullable<RawTool['npm']>, string>;

export type PresetKind = 'language' | 'framework' | 'platform' | 'tool' | 'library' | 'database' | 'concern';

export type Stage = 'commit' | 'push' | 'manual' | 'message';

export type Requirement = 'build' | 'docker' | 'network';

export type FixOrder = 'codemod' | 'imports' | 'manifest' | 'format';

export type PresetHeader = {
    name: string;
    kind: PresetKind;
    title: string;
    requires: string[];
    recommends: string[];
    default: boolean;
    proposed: boolean;
    description: string;
};

export type Detect = {
    extensions: string[];
    filenames: string[];
    dependencies: string[];
    shebangs: string[];
    tags: string[];
    paths: string[];
};

export type Claims = RawManifest['claims'];

/** The output fields accepted by both preset and repository checks. */
export type OutputFormat = z.infer<typeof outputSchema>;

export type InstallerPin = Pick<NpmInstallerDefinition, 'name'> & Partial<Omit<NpmInstallerDefinition, 'name'>>;

export type ToolPin = {
    name: string;
    kind?: 'binary' | 'library';
    version?: string;
    floor?: string;
    provider?: 'host';
    windows: boolean;
    version_command?: string[];
    version_exit_code?: number;
    version_regex?: string;
    suppression?: NonNullable<RawTool['suppression']>;
    env?: Record<string, string>;
    installers: Record<string, InstallerPin>;
};

export type ConfigurationTarget = RawManifest['configs'][number];

export type StubSpec = NonNullable<ConfigurationTarget['stub']>;

/** Validated execution variants, with absent optional values removed by normalization. */
export type CheckSpec = Defined<RawCheck>;

export type SettingKind = 'number' | 'string' | 'boolean' | 'list' | 'table';

export type SettingDirection = 'ceiling' | 'floor' | 'loosening' | 'tightening' | 'neutral' | 'per-rule';

export type SettingSpec = {
    name: string;
    kind: SettingKind;
    direction: SettingDirection;
    default?: unknown;
    summary: string;
    languages?: string[];
    categories?: string[];
};

export type Manifest = {
    preset: PresetHeader;
    detect: Detect;
    claims: Claims;
    tools: ToolPin[];
    configs: ConfigurationTarget[];
    checks: CheckSpec[];
    settings: SettingSpec[];
    coverage: Record<string, string[]>;
    rule_files: Record<string, string[]>;
    required_rules: Record<string, string[]>;
    dir: string;
};

export type ListingRow = {
    name: string;
    kind: string;
    title: string;
    description: string;
    requires: string[];
    tools: string[];
    checks: { check: string; stage: string }[];
    settings: string[];
    rules: string[];
    default: boolean;
    proposed: boolean;
};

export type Proposal = { preset: string; evidence: string; kind: string; count?: number };

export type UnknownLanguage = { language: string; extensions: string[]; count: number };

export type LinguistEntry = {
    extensions?: readonly string[];
    type?: string;
    filenames?: readonly string[];
    aliases?: readonly string[];
};

/** manifest.toml as the schema accepts it. */
export type RawManifest = z.infer<typeof manifestSchema>;

/** One [[tools]] entry as written. */
export type RawTool = RawManifest['tools'][number];

/** One [[checks]] entry as written. */
export type RawCheck = RawManifest['checks'][number];

/** The state of one selection walk over the requires graph. */
export type SelectionWalk = {
    manifests: Map<string, Manifest>;
    problems: string[];
    order: Manifest[];
    seen: Set<string>;
    visiting: string[];
};
