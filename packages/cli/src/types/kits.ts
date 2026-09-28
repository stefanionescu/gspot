// The types of configurations in this package.
import type { z } from 'zod';
import type { TOOL_PLATFORMS } from '#cli/config/kits.ts';
import type { manifestSchema } from '#cli/kits/schema.ts';
import type { Defined } from '#cli/types/policy/policy.ts';
import type { outputSchema } from '#cli/kits/output-format.ts';

export type KitEvidence = { configuration: string; evidence: string; kind: string; count?: number };
export type ExecutionFields<Check> = Check extends unknown ? Omit<Check, 'example'> : never;
export type Stage = RawCheck['stage'];
export type FixOrder = 'codemod' | 'imports' | 'manifest' | 'format';
export type Owners = RawManifest['owners'];
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
export type KitHeader = Omit<RawManifest['kit'], 'check_references'> & {
    check_references?: RawManifest['kit']['check_references'];
};
export type InstallerPin = Pick<NpmInstallerDefinition, 'name'> & Partial<Omit<NpmInstallerDefinition, 'name'>>;
/** A platform a tool pin may name: an operating system alone, or one with an architecture. */
export type ToolPlatform = (typeof TOOL_PLATFORMS)[number];
export type ToolPin = {
    name: string;
    kind?: 'binary' | 'library';
    version?: string;
    floor?: string;
    provider?: 'host';
    /** The platforms the tool has a build for; unset means every platform. */
    platforms?: readonly ToolPlatform[];
    version_command?: string[];
    version_exit_code?: number;
    version_regex?: string;
    crash_pattern?: string;
    rule_page?: string;
    suppression?: NonNullable<RawTool['suppression']>;
    replace?: NonNullable<RawTool['replace']>;
    query_packs?: NonNullable<RawTool['query_packs']>;
    prettier?: NonNullable<RawTool['prettier']>;
    env?: Record<string, string>;
    installers: Record<string, InstallerPin>;
};
export type Manifest = Omit<RawManifest, 'kit' | 'tools' | 'checks' | 'settings'> & {
    kit: KitHeader;
    tools: ToolPin[];
    checks: CheckSpec[];
    settings: SettingSpec[];
    dir: string;
};
export type CheckRule = { applies: (check: RawCheck) => boolean; problem: (check: RawCheck) => string };
export type Checks = Map<string, Manifest['checks'][number]>;
export type Settings = Map<string, Manifest['settings'][number]>;
