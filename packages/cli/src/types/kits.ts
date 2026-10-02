// The types of kits in this package.
import type { z } from 'zod';
import type { TOOL_PLATFORMS } from '#cli/config/kits.ts';
import type { manifestSchema } from '#cli/kits/schema.ts';
import type { Read, Defined } from '#cli/types/platform/platform.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';

type ExecutionFields<Check> = Check extends unknown ? Omit<Check, 'example'> : never;

/** A platform a tool pin may name: an operating system alone, or one with an architecture. */
type ToolPlatform = (typeof TOOL_PLATFORMS)[number];

type KitHeader = Omit<RawManifest['kit'], 'check_references'> & {
    check_references?: RawManifest['kit']['check_references'];
};

type NpmInstallerDefinition = Exclude<NonNullable<RawTool['npm']>, string>;

export type GeneratedFile = {
    rulesPath?: string[];
    path: string;
    content: string;
    readOnly: boolean;
    executable?: boolean;
    read?: Read;
    kind: 'lock' | 'config' | 'pointer' | 'hook' | 'runner' | 'workflow' | 'rules' | 'managed-block';
    kit?: string;
};

export type PolicyScope = { path: string; kits: string[] };

export type KitEvidence = { kit: string; evidence: string; kind: string; count?: number };

export type Owners = RawManifest['files'];
export type ConfigurationTarget = RawManifest['configs'][number];

/** Validated execution variants. Repository-defined commands do not require reference examples. */
export type CheckSpec = ExecutionFields<Defined<RawCheck>> & { example?: string };

/** manifest.toml as the schema accepts it. */
export type RawManifest = z.infer<typeof manifestSchema>;

/** One [[tool]] entry as written. */
export type RawTool = RawManifest['tools'][number];

/** One [[check]] entry as written. */
export type RawCheck = RawManifest['checks'][number];
export type SelectionWalk = {
    manifests: Map<string, Manifest>;
    problems: string[];
    order: Manifest[];
    seen: Set<string>;
    visiting: string[];
};

export type ToolPin = {
    name: string;
    kind?: 'binary' | 'library';
    version?: string;
    floor?: string;
    host?: boolean;
    /** The platforms the tool has a build for; unset means every platform. */
    platforms?: readonly ToolPlatform[];
    version_command?: string[];
    version_exit_code?: number;
    version_pattern?: string;
    crash_pattern?: string;
    rule_url?: string;
    suppression?: NonNullable<RawTool['suppression']>;
    replace?: NonNullable<RawTool['replace']>;
    query_packs?: NonNullable<RawTool['query_packs']>;
    prettier?: NonNullable<RawTool['prettier']>;
    eslint?: NonNullable<RawTool['eslint']>;
    env?: Record<string, string>;
    installers: Record<string, InstallerPin>;
};

export type CheckRule = { applies: (check: RawCheck) => boolean; problem: (check: RawCheck) => string };
export type Checks = Map<string, Manifest['checks'][number]>;
export type Settings = Map<string, Manifest['settings'][number]>;

/** What detection reads from a scope's tree once, for every manifest to look at. */
export type Layout = {
    candidates: TrackedFile[];
    extensionCounts: Map<string, number>;
    names: Set<string>;
    shebangs: Set<string>;
    dependencies: Map<string, string>;
    scope: string;
};

export type SettingSpec = Defined<RawManifest['settings'][number]>;

export type Manifest = Omit<RawManifest, 'kit' | 'tools' | 'checks' | 'settings'> & {
    kit: KitHeader;
    tools: ToolPin[];
    checks: CheckSpec[];
    settings: SettingSpec[];
    dir: string;
};

export type InstallerPin = Pick<NpmInstallerDefinition, 'name'> &
    Partial<Omit<NpmInstallerDefinition, 'name'>> & {
        options?: Record<string, string | boolean>;
        constraints?: string[];
    };
