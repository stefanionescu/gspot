import type { JsonValue } from '#cli/types/parsers/json.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { WrittenSettings } from '#cli/types/settings/file.ts';
import type { PathExpressions } from '#cli/types/repository/inventory.ts';
import type { Manifest, EslintAllRules } from '#cli/types/configurations.ts';
import type { Settings, ScopeView, ScopeSelection } from '#cli/types/settings/values.ts';

/** The `[tools.eslint]` table of gspot.toml. */
type EslintSettings = NonNullable<NonNullable<WrittenSettings['tools']>['eslint']>;

/** File selectors used by the composed architecture and tRPC policies. */
type EslintBoundaryFile = {
    path?: string | readonly string[];
    categories?: string | { anyOf?: readonly string[]; noneOf?: readonly string[] };
    isUnknown?: boolean;
};

export type FragmentPreset = {
    source: string;
    blocks: [EslintSettingsBlock & { parser: boolean }, ...(EslintSettingsBlock & { parser: boolean })[]];
};

export type EslintRuleBlock = PathExpressions & { scope: string; rules: Record<string, unknown> };

/** Your own rule options do not choose rule severity or whether a rule runs. */
export type EslintRuleOptions = PathExpressions & { scope: string; rules: NonNullable<EslintSettings['rules']> };

/** Generated rule blocks retain their level, project paths, and your own options. */
export type BlockWriterInput = {
    source: string;
    allRules: EslintAllRules;
    isAll: boolean;
    codeFiles: string[];
    ruleOptions: EslintRuleOptions[];
    scope?: { path: string; excluded: string[] };
};

/** One no-restricted-syntax rule: its file set, or every code file when absent, and the selectors it holds. */
export type SelectorGroup = {
    scope?: string;
    ignoredScopes?: string[];
    files?: (string | string[])[];
    ignores?: string[];
    selectors: { selector: string; message: string }[];
};

/** One block of the generated ESLint configuration: the files it covers and what it sets for them. */
export type EslintBlock = {
    files: (string | string[])[];
    ignores?: string[];
    settings?: Record<string, unknown>;
    rules?: Record<string, unknown>;
};

/** Module dependency restrictions apply before the tRPC value restriction. */
export type EslintBoundaryPolicy = {
    from?: { file: EslintBoundaryFile | readonly EslintBoundaryFile[] };
    allow?: { to: { file: EslintBoundaryFile } };
    disallow?: {
        to: { file: EslintBoundaryFile };
        dependency?: { kind: 'value' };
    };
};

/** Classification data shared by the settings and dependency settings constructors. */
export type EslintBoundaryContext = {
    modules: NonNullable<NonNullable<ScopeView['values']['architecture']>['module']>;
    enforceTests: boolean;
    tests: string[];
    trpcPaths: string[];
};

/** The parts of the ESLint configuration that the settings and the scope decide. */
export type EslintParts = {
    projects: string[];
    nodeFiles: string[];
    testFiles: string[];
    scriptFiles: string[];
    allLevelRules: Record<string, unknown>;
    importStyleBlocks: EslintBlock[];
    runtimes: EslintRuntimeBlock[];
    boundaryBlocks: EslintBlock[];
    scopeBlocks: EslintBlock[];
    ignoredPaths: string[];
    restrictedImports: unknown[];
    extra: { reason: string | undefined; entries: Record<string, unknown> } | undefined;
};

/** Your own rules for one repository scope. */
export type ScopeEslintSettings = { scope: string; settings: EslintSettings };

/** One runtime declaration with readable include and exclude globs. */
export type EslintRuntimeBlock = PathExpressions & {
    scope: string;
    runtime: string;
};

/** A function selector retains the exact declarations that generate it. */
export type EslintFileSelector =
    | string
    | { component: 'vue' | 'svelte' }
    | { runtime: { declarations: EslintRuntimeBlock[]; index: number } };

/** Serializable rule fields that generation and the baseline of the last apply share. */
export type EslintSettingsBlock = {
    files?: readonly (EslintFileSelector | EslintFileSelector[])[];
    ignores?: string[];
    basePath?: string;
    rules?: Record<string, unknown>;
};

/** A block writer bound to its scope. */
export type BlockWriter = {
    block: (block: EslintSettingsBlock, runtime?: string, preset?: EslintRuleExpression) => string;
};

/** Component patterns, detected Node files, and your test or script patterns. */
export type EslintFileInputs = {
    components: Manifest[];
    tests: string[];
    scripts: string[];
    nodeFiles: string[];
};

/** Shared file patterns for code, type-aware parsing, and test or script intersections. */
export type EslintFiles = {
    code: string[];
    typescriptSource: string[];
    typescript: (EslintFileSelector | EslintFileSelector[])[];
    javascript: string[];
    tests: string[][];
    scripts: string[][];
};

export type FragmentPresets = EslintPresets & {
    strict: FragmentPreset;
    untyped: FragmentPreset;
    recommended: FragmentPreset;
    jsx: FragmentPreset;
    hooks: FragmentPreset;
    refresh: FragmentPreset;
    accessibility: FragmentPreset;
    noSwagger: FragmentPreset;
};

export type RuleNamesFile = { package: string; version: string; source: string; rules: string[] };

export type EslintPresets = Record<
    string,
    {
        package: string;
        version: string;
        source: string;
        blocks: {
            parser: boolean;
            files?: (string | string[])[] | undefined;
            ignores?: string[] | undefined;
            basePath?: string | undefined;
            rules?: Record<string, JsonValue> | undefined;
        }[];
    }
>;

/** Inputs and printers shared by the ESLint fragment builders. */
export type EslintContext = {
    generatedPatterns: string[];
    root: string;
    reads: ReadCache;
    scopes: ScopeSelection[];
    selection: ScopeSelection;
    nodeFiles: string[];
    ruleOptions: EslintRuleOptions[];
    eslint: EslintParts;
    blockWriter: BlockWriter;
    eslintFiles: EslintFiles;
    settingsBlocks: EslintRuleBlock[];
    eslintAllRules: Set<string>;
    eslintPresets: Map<string, EslintPresets>;
    configurations: string[];
    settings: ScopeView['settings'];
    roles: ScopeView['roles'];
    testFiles: string[];
    scope: string;
    scopeDependencies: string[];
    testRuleNames: readonly string[];
    isAll: boolean;
    repositorySettings: Settings;
    /** Source file paths; a fragment gets only the files of its scope. */
    sourceFiles: string[];
};

/** The expression and captured values of rules supplied by a pinned preset. */
export type EslintRuleExpression = { expression: string; rules: Record<string, unknown> | undefined };

/** Rule values grouped by source language and runtime use. */
export type EslintLevelRules = {
    code: Record<string, unknown>;
    javascript: Record<string, unknown>;
    node: Record<string, unknown>;
    console: Record<string, unknown>;
};

/** Imported plugin bindings paired with their package specifiers. */
export type EslintPlugins = Record<string, readonly [string, string]>;

/** A component file dialect, its parser, and syntax allowances. */
export type StylelintComponent = {
    files: readonly string[];
    customSyntax: string;
    ignorePseudoClasses: readonly string[];
    functions?: readonly string[];
};

/** The imports and blocks that one ESLint fragment produces. */
export type EslintFragment = { imports: string[]; blocks: string };

/** Relative-import enforcement with explicit project folders and import aliases. */
export type EslintImportBoundaryRule = ['error', { folders: string[]; aliases: Record<string, string> }];

/** Repository facts shared by ESLint selectors, boundaries, and rule blocks. */
export type EslintFacts = Pick<
    EslintContext,
    'root' | 'reads' | 'scopes' | 'repositorySettings' | 'selection' | 'nodeFiles' | 'generatedPatterns'
>;
