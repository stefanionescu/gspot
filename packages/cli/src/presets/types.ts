import type { z } from 'zod';
import type { Defined } from '#cli/policy/types.ts';
import type { outputSchema } from '#cli/presets/output-schema.ts';
import type { manifestSchema } from '#cli/presets/manifest-schema.ts';
// The shape of a preset manifest.toml after validation.

type ExecutionFields<Check> = Check extends unknown ? Omit<Check, 'example'> : never;

type NpmInstallerDefinition = Exclude<NonNullable<RawTool['npm']>, string>;

export type PresetKind = 'language' | 'framework' | 'platform' | 'tool' | 'library' | 'database' | 'policy';

export type Stage = 'commit' | 'push' | 'manual' | 'message';

export type FixOrder = 'codemod' | 'imports' | 'manifest' | 'format';

export type PresetHeader = {
    name: string;
    kind: PresetKind;
    title: string;
    requires: string[];
    check_references?: string[];
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
    takeover?: NonNullable<RawTool['takeover']>;
    query_packs?: NonNullable<RawTool['query_packs']>;
    env?: Record<string, string>;
    installers: Record<string, InstallerPin>;
};

export type ConfigurationTarget = RawManifest['configs'][number];

export type StubSpec = NonNullable<ConfigurationTarget['stub']>;

/** Validated execution variants. Repository-defined commands do not require reference examples. */
export type CheckSpec = ExecutionFields<Defined<RawCheck>> & { example?: string };

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
    untracked: RawManifest['untracked'];
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

/** manifest.toml as the schema accepts it. */
export type RawManifest = z.infer<typeof manifestSchema>;

/** One [[tools]] entry as written. */
export type RawTool = RawManifest['tools'][number];

/** One [[checks]] entry as written. */
export type RawCheck = RawManifest['checks'][number];
