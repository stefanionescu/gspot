import type { FileSnapshot } from '#cli/lifecycle/types.ts';
import type { PathExpressions } from '#cli/repository/types.ts';
// What apply renders and writes: generated files, blocks, merges, package edits, the workflow and the hooks.
import type { Policy, MergedView, FormatSettings } from '#cli/policy/types.ts';
import type { ScopeSelection, Session } from '#cli/run/types.ts';
import type { ConfigurationTarget, Manifest } from '#cli/presets/types.ts';

export type GeneratedFile = {
    path: string;
    content: string;
    readOnly: boolean;
    executable?: boolean;
    observed?: FileSnapshot;
    kind: 'lock' | 'config' | 'stub' | 'hook' | 'runner' | 'workflow' | 'rules' | 'managed-block';
    preset?: string;
};

export type DriftEntry = {
    path: string;
    kind: 'changed' | 'missing' | 'stray';
    diff?: string;
};

export type HookName = 'pre-commit' | 'pre-push' | 'commit-msg';

export type BlockStyle = 'markdown' | 'hash';

export type ApplyReport = {
    preserved: string[];
    written: string[];
    unchanged: string[];
    removed: string[];
    blocks: string[];
    packages: string[];
    notes: string[];
};

export type ApplyOptions = {
    cwd: string;
    isDryRun: boolean;
};

export type BlockOutput = { path: string; block: string; style: 'markdown' | 'hash' };

export type MergeOutput = {
    path: string;
    content: string;
    keys: string[];
    target: string;
    stub: ConfigurationTarget['stub'] & object;
};

export type PackageOutput = { path: string; scripts: Record<string, string> };

export type LefthookOutput = { path: string; block: LefthookBlock };

export type GeneratedProposal = {
    notes: string[];
    files: GeneratedFile[];
    blocks: BlockOutput[];
    merges: MergeOutput[];
    packages: PackageOutput[];
    lefthook?: LefthookOutput;
};

export type EslintRuleBlock = PathExpressions & { scope: string; rules: Record<string, unknown> };

export type ScopedFormat = { scope: string; paths: string[]; format: Partial<FormatSettings> };
export type EditorconfigOverride = { path: string; options: Record<string, string | number | boolean> };

export type TemplateInputs = {
    targetPath?: string;
    prettierConfig: (targetPath: string) => Record<string, unknown>;
    editorconfigOverrides: () => EditorconfigOverride[];
    eslintPolicy: EslintRuleBlock[];
    isAll: boolean;
    typescriptOptions: Record<string, boolean>;
    prose: { blockIgnores: string[]; tokenIgnores: string[]; styles: string[] };
    version: string;
    scope: string;
    scopes: { path: string; presets: string[] }[];
    presets: string[];
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
    has: (preset: string) => boolean;
    files: (extension: string) => string[];
    importAliases: (scope: string) => Record<string, string>;
    tools: string[];
    /** The npm package of every selected tool that has one. */
    toolPackages: string[];
    header: string;
    headerLines: string[];
};

/** The part of package.json the alias reader looks at. */
export type PackageImports = { imports?: Record<string, unknown> };

/** The part of package.json apply reads and writes. */
export type PackageContent = { scripts?: Record<string, string> };

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
