import type { z } from 'zod';
import type { manifestSchema } from '#cli/presets/manifest-schema.ts';
// The shape of a preset manifest.toml after validation.

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
    conflicts: string[];
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

export type Claims = {
    extensions: string[];
    filenames: string[];
    tags: string[];
    paths: string[];
    from_languages: boolean;
    natures: string[];
};

export type OutputFormat = {
    format: 'regex' | 'grouped' | 'eslint-json' | 'json' | 'lines' | 'none';
    items?: string | undefined;
    children?: string | undefined;
    line_base?: number | undefined;
    /** What the file group of a finding holds: a path in the repository, a link target, or a path in a past commit. The last two need not exist. */
    file_is?: 'path' | 'link' | 'history' | undefined;
    fields?: Partial<Record<'file' | 'line' | 'column' | 'rule' | 'message', string | undefined>> | undefined;
    pattern?: string;
    file_pattern?: string;
    fixable?: string;
    message?: string;
};

export type ToolPin = {
    name: string;
    kind?: 'binary' | 'library';
    version?: string;
    floor?: string;
    provider?: 'host';
    windows: boolean;
    version_command?: string[];
    version_regex?: string;
    installers: Record<string, string>;
};

export type StubSpec = {
    path: string;
    body?: string;
    merge?: Record<string, unknown>;
    copy?: boolean;
};

export type ConfigurationTarget = {
    template: string;
    target: string;
    stub?: StubSpec;
    fragment?: boolean;
    per_scope?: boolean;
    executable?: boolean;
    header?: boolean;
    needs?: string | undefined;
};

export type CheckSpec = {
    name: string;
    stage: Stage;
    runs: 'per-file-list' | 'per-scope' | 'once';
    command?: string[];
    fix_command?: string[];
    fix_order?: FixOrder;
    baseline_file?: string;
    baseline_command?: string[];
    prune_command?: string[];
    engine?: string;
    analysis?: string;
    reported_by?: string;
    takes_over?: string;
    limit?: string;
    count_regex?: string;
    tool_errors?: string;
    requires?: Requirement;
    platform?: string[];
    tool?: string;
    claims?: Claims;
    output?: OutputFormat;
    cwd?: 'root' | 'scope';
    exclude_setting?: string;
    coverage: string[];
    summary: string;
    why: string;
    help: string;
    searched?: string[];
};

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

/** One [[configs]] entry as written. */
export type RawConfiguration = RawManifest['configs'][number];

/** The state of one selection walk over the requires graph. */
export type SelectionWalk = {
    manifests: Map<string, Manifest>;
    problems: string[];
    order: Manifest[];
    seen: Set<string>;
    visiting: string[];
};
