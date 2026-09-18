// The shape of a preset manifest.toml after validation.

export type PresetKind = 'language' | 'framework' | 'platform' | 'tool' | 'library' | 'database' | 'repository';

export type Stage = 'commit' | 'push' | 'manual' | 'message';

export type Requirement = 'build' | 'docker' | 'network';

export type FixOrder = 'codemod' | 'imports' | 'manifest' | 'format';

export type PresetHeader = {
    id: string;
    kind: PresetKind;
    title: string;
    requires: string[];
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
    format: 'regex' | 'grouped' | 'eslint-json' | 'lines' | 'none';
    pattern?: string;
    file_pattern?: string;
    fixable?: string;
    message?: string;
};

export type ToolPin = {
    name: string;
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

export type ConfigTarget = {
    template: string;
    target: string;
    stub?: StubSpec;
    fragment?: boolean;
    per_scope?: boolean;
    executable?: boolean;
    header?: boolean;
};

export type CheckSpec = {
    id: string;
    stage: Stage;
    takes: 'files' | 'project';
    command?: string[];
    fix_command?: string[];
    fix_order?: FixOrder;
    engine?: string;
    analysis?: string;
    rules?: string;
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
    inspection: string[];
    summary: string;
    why: string;
    fix: string;
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
    configs: ConfigTarget[];
    checks: CheckSpec[];
    settings: SettingSpec[];
    required: Record<string, string[]>;
    rules: Record<string, string[]>;
    dir: string;
};
