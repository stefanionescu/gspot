// The types of generation in this package.
import type { FileSnapshot } from '#cli/types/platform.ts';
import type { ToolPackageManager } from '#cli/types/tools/packages.ts';
import type { HOOK_FILES } from '#cli/constants/repository/repository.ts';
import type { ConfigurationFormat } from '#cli/types/lifecycle/lifecycle.ts';
import type { PathExpressions, TrackedFile } from '#cli/types/repository/repository.ts';
import type { ConfigurationTarget, FragmentSelector, Manifest } from '#cli/types/configurations.ts';
import type { FormatSettings, MergedView, Policy, ScopeSelection } from '#cli/types/policy/policy.ts';

export type Fragment = { manifest: Manifest; config: ConfigurationTarget };
export type WorkflowShape = {
    version: string;
    run?: NonNullable<Policy['ci']>['run'];
    sarif?: NonNullable<Policy['ci']>['sarif'];
    platforms: string[];
    /** The Swift scope path, or undefined when no scope selects swift. */
    swiftScope: string | undefined;
    isMise: boolean;
};
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
    prose: { blockIgnores: string[]; tokenIgnores: string[]; styles: string[]; formats: [string, string][] };
    version: string;
    scope: string;
    scopes: { path: string; configurations: string[] }[];
    configurationScopes: (configuration: string) => { path: string; settings: Record<string, unknown> }[];
    /** The folders the selected settings with this role name, for the scope being rendered. */
    roleFolders: (role: string) => string[];
    /** The same per scope, shallowest first, for the scopes where a selected setting carries the role. */
    roleScopes: (role: string) => { path: string; folders: string[] }[];
    configurations: string[];
    policy: Policy;
    view: MergedView;
    format: MergedView['format'];
    settings: Record<string, unknown>;
    fragments: string;
    fragmentImports: string;
    fragmentFiles: string[];
    fragmentSelectors: SelectorGroup[];
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
    files: (extension: string) => string[];
    importAliases: (scope: string) => Record<string, string>;
    tools: string[];
    /** The npm package of every selected tool that has one. */
    toolPackages: string[];
    header: string;
    headerLines: string[];
};
export type GeneratedFile = {
    rulesPath?: string[];
    path: string;
    content: string;
    readOnly: boolean;
    executable?: boolean;
    observed?: FileSnapshot;
    kind: 'lock' | 'config' | 'pointer' | 'hook' | 'runner' | 'workflow' | 'rules' | 'managed-block';
    configuration?: string;
};
export type BlockOutput = { path: string; block: string; style: 'markdown' | 'hash' };
export type ConfigurationOutput = {
    path: string;
    format: ConfigurationFormat;
    changes: { path: (string | number)[]; value: unknown }[];
};
export type GeneratedProposal = {
    notes: string[];
    files: GeneratedFile[];
    blocks: BlockOutput[];
    merges: ConfigurationOutput[];
    configurations: ConfigurationOutput[];
};
export type FormatOverride = { files: string[]; excludeFiles: string[]; options: Record<string, unknown> };
/** A Prettier plugin a selected manifest ships: its npm name, its entry file, and the overrides its files need. */
export type PrettierPlugin = {
    name: string;
    entry: string;
    overrides: { files: string; options: Record<string, unknown> }[];
};
export type ScopedFormat = { scope: string; paths: string[]; format: Partial<FormatSettings> };
export type EditorconfigOverride = { path: string; options: Record<string, string | number | boolean> };
export type Basename = { isNegated: boolean; basename: string };
export type Group<Options> = {
    patterns: string[];
    excluded: string[];
    options: Options;
    hasSlash: boolean;
    base: string;
    fromConfig: (pattern: string) => string;
};
export type NativeOverride<Options> = {
    files: string | string[];
    excludeFiles?: string | string[] | undefined;
    options: Options;
};
export type EslintRuleBlock = PathExpressions & { scope: string; rules: Record<string, unknown> };
/** A fragment selector with the allowed setting replaced by the paths it holds. */
export type ResolvedSelector = Pick<FragmentSelector, 'selector' | 'message' | 'files'> & { except?: string[] };
/** One no-restricted-syntax rule: its file set, or every code file when absent, and the selectors it holds. */
export type SelectorGroup = { files?: string[]; selectors: { selector: string; message: string }[] };
export type GenerationOptions = {
    version: string;
    packageManager: ToolPackageManager | undefined;
    takeover?: ReadonlyMap<string, FileSnapshot> | undefined;
};
export type JsonFormat = { width: number; indent: number };
export type HookName = (typeof HOOK_FILES)[number];
export type LefthookBlock = Record<string, { commands: Record<string, unknown> }>;
export type Pointer = NonNullable<ConfigurationTarget['pointer']>;
/** What emitting one manifest in one scope needs. */
export type EmitContext = {
    root: string;
    files: TrackedFile[];
    scopes: ScopeSelection[];
    inputs: TemplateInputs;
    selection: ScopeSelection;
    manifest: Manifest;
};
export type Retention = {
    root: string;
    policy: Policy;
    files: TrackedFile[];
    takeover: ReadonlyMap<string, FileSnapshot> | undefined;
};
