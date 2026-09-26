// The types of configurations in this package.
import type { z } from 'zod';
import type { Defined } from '#cli/types/policy/policy.ts';
import type { manifestSchema } from '#cli/configurations/schema.ts';
import type { outputSchema } from '#cli/configurations/output-format.ts';

export type ConfigurationEvidence = { configuration: string; evidence: string; kind: string; count?: number };
export type ExecutionFields<Check> = Check extends unknown ? Omit<Check, 'example'> : never;
export type Stage = RawCheck['stage'];
export type FixOrder = 'codemod' | 'imports' | 'manifest' | 'format';
export type Claims = RawManifest['claims'];
export type ConfigurationTarget = RawManifest['configs'][number];
export type FragmentSelector = RawManifest['configs'][number]['selectors'][number];
export type PointerSpec = NonNullable<ConfigurationTarget['pointer']>;
/** Validated execution variants. Repository-defined commands do not require reference examples. */
export type CheckSpec = ExecutionFields<Defined<RawCheck>> & { example?: string };
export type SettingSpec = Defined<RawManifest['settings'][number]>;
/** manifest.toml as the schema accepts it. */
export type RawManifest = z.infer<typeof manifestSchema>;
/** One [[tools]] entry as written. */
export type RawTool = RawManifest['tools'][number];
/** One [[checks]] entry as written. */
export type RawCheck = RawManifest['checks'][number];
export type LinguistEntry = {
    extensions?: readonly string[];
    type?: string;
    filenames?: readonly string[];
    aliases?: readonly string[];
};
export type UnknownLanguage = { language: string; extensions: string[]; count: number };
export type SelectionWalk = {
    manifests: Map<string, Manifest>;
    problems: string[];
    order: Manifest[];
    seen: Set<string>;
    visiting: string[];
};
/** The output fields accepted by both configuration and repository checks. */
export type OutputFormat = z.infer<typeof outputSchema>;
/** A script with no extension reads through stdin as Python, whose comments start the same way. */
export const SCRIPT_GRAMMAR = { mode: 'stdin', extension: '.py' } as const;
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
export type NpmInstallerDefinition = Exclude<NonNullable<RawTool['npm']>, string>;
export type ConfigurationHeader = Omit<RawManifest['configuration'], 'check_references'> & {
    check_references?: RawManifest['configuration']['check_references'];
};
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
    crash_pattern?: string;
    rule_page?: string;
    suppression?: NonNullable<RawTool['suppression']>;
    takeover?: NonNullable<RawTool['takeover']>;
    query_packs?: NonNullable<RawTool['query_packs']>;
    prettier?: NonNullable<RawTool['prettier']>;
    env?: Record<string, string>;
    installers: Record<string, InstallerPin>;
};
export type Manifest = Omit<RawManifest, 'configuration' | 'tools' | 'checks' | 'settings'> & {
    configuration: ConfigurationHeader;
    tools: ToolPin[];
    checks: CheckSpec[];
    settings: SettingSpec[];
    dir: string;
};
export type CheckRule = { applies: (check: RawCheck) => boolean; problem: (check: RawCheck) => string };
export type Checks = Map<string, Manifest['checks'][number]>;
export type Settings = Map<string, Manifest['settings'][number]>;
