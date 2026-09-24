import type { FileSnapshot } from '#cli/types/filesystem.ts';
import type { PathExpressions } from '#cli/types/repository.ts';
import type { ScopeSelection, Session } from '#cli/types/execution.ts';
import type { FormatSettings, MergedView, Policy } from '#cli/types/policy.ts';
// What apply renders and writes: generated files, blocks, merges, package edits, the workflow and the hooks.
import type { ConfigurationTarget, Manifest } from '#cli/types/configurations.ts';

export type GeneratedFile = {
    rulesPath?: string[];
    path: string;
    content: string;
    readOnly: boolean;
    executable?: boolean;
    observed?: FileSnapshot;
    kind: 'lock' | 'config' | 'stub' | 'hook' | 'runner' | 'workflow' | 'rules' | 'managed-block';
    configuration?: string;
};

export type DriftEntry = {
    path: string;
    kind: 'changed' | 'missing' | 'stray';
    diff?: string;
    rules?: { path: string; added: string[]; removed: string[]; changed: string[] }[];
    ruleError?: string;
};

export type HookName = 'pre-commit' | 'pre-push' | 'commit-msg';

export type BlockStyle = 'markdown' | 'hash';

export type BlockOutput = { path: string; block: string; style: 'markdown' | 'hash' };

export type MergeOutput = {
    path: string;
    content: string;
    keys: string[];
    target: string;
    stub: ConfigurationTarget['stub'] & object;
};

export type ConfigurationOutput = {
    path: string;
    format: 'json' | 'yaml' | 'toml';
    changes: { path: (string | number)[]; value: unknown }[];
};

export type GeneratedProposal = {
    notes: string[];
    files: GeneratedFile[];
    blocks: BlockOutput[];
    merges: MergeOutput[];
    configurations: ConfigurationOutput[];
};

export type EslintRuleBlock = PathExpressions & { scope: string; rules: Record<string, unknown> };

export type ScopedFormat = { scope: string; paths: string[]; format: Partial<FormatSettings> };
export type EditorconfigOverride = { path: string; options: Record<string, string | number | boolean> };

export type TemplateInputs = {
    markdownlintRules: Record<string, unknown>;
    targetPath?: string;
    scopeIgnorePatterns: (patterns: string[], scope: string) => string[];
    javascriptConfig: (targetPath: string) => Record<string, unknown>;
    prettierConfig: (targetPath: string) => Record<string, unknown>;
    editorconfigOverrides: () => EditorconfigOverride[];
    eslintPolicy: EslintRuleBlock[];
    isAll: boolean;
    typescriptOptions: Record<string, boolean>;
    prose: { blockIgnores: string[]; tokenIgnores: string[]; styles: string[] };
    version: string;
    scope: string;
    scopes: { path: string; configurations: string[] }[];
    configurationScopes: (configuration: string) => { path: string; settings: Record<string, unknown> }[];
    configurations: string[];
    policy: Policy;
    view: MergedView;
    format: MergedView['format'];
    settings: Record<string, unknown>;
    fragments: string;
    tool: (name: string) => Record<string, unknown>;
    entryFiles: (scope: string) => string[];
    limit: (key: string, language?: string) => number | undefined;
    rulesOff: (check: string) => string[];
    ignoresFor: MergedView['ignoresFor'];
    extra: (name: string) => Record<string, unknown> | undefined;
    json: (value: unknown, indent?: number) => string;
    toml: (value: Record<string, unknown>) => string;
    yaml: (value: Record<string, unknown>) => string;
    tomlDate: new (value: string) => Date;
    has: (configuration: string) => boolean;
    files: (extension: string) => string[];
    importAliases: (scope: string) => Record<string, string>;
    tools: string[];
    /** The npm package of every selected tool that has one. */
    toolPackages: string[];
    header: string;
    headerLines: string[];
};

/** What rendering one manifest's files in one scope needs. */
export type EmitContext = { session: Session; selection: ScopeSelection; manifest: Manifest };

/** What the workflow emitter needs to know. */
export type WorkflowShape = {
    version: string;
    run?: NonNullable<Policy['ci']>['run'];
    sarif?: NonNullable<Policy['ci']>['sarif'];
    platforms: string[];
    /** The Swift scope path, or undefined when no scope selects swift. */
    swiftScope: string | undefined;
    isMise: boolean;
};

/** How generated JSON is laid out: the Prettier print width and indent width. */
export type JsonFormat = { width: number; indent: number };

/** The hook commands lefthook.yml carries per hook. */
export type LefthookBlock = Record<string, { commands: Record<string, unknown> }>;

export type ApplyReport = {
    preserved: string[];
    written: string[];
    unchanged: string[];
    removed: string[];
    blocks: string[];
    packages: string[];
    notes: string[];
};
