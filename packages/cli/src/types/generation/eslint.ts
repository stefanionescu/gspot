import type { Session } from '#cli/types/session.ts';
import type { JsonValue } from '#cli/types/shapes.ts';
import type { Settings, WrittenSettings } from '#cli/types/settings/file.ts';
import type { Scope, ScopeSettings } from '#cli/types/settings/inheritance.ts';
import type { COMPONENT_CONFIGURATIONS } from '#cli/config/generation/eslint/files.ts';
import type { Level, Configuration, ParsedManifest } from '#cli/types/configurations.ts';

/** The `[tools.eslint]` table of gspot.toml. */
type EslintSettings = NonNullable<NonNullable<WrittenSettings['tools']>['eslint']>;

/** A file matcher of an eslint-plugin-boundaries policy: paths, categories, or files that no category covers. */
type EslintBoundaryFile = {
    path?: string | readonly string[];
    categories?: string | { anyOf?: readonly string[]; noneOf?: readonly string[] };
    isUnknown?: boolean;
};

export type PathExpressions = { includes: string[]; excludes: string[] };

/** A selector that a configuration adds, with its resolved source paths. */
export type SelectorPaths = Pick<ParsedManifest['eslint']['selectors'][number], 'selector' | 'message'> & {
    files?: string[];
    except?: string[];
};

export type EslintRuleBlock = PathExpressions & { scope: string; rules: Record<string, unknown> };

/**
 * The options of your own ESLint rules for one scope and its paths; they never turn a rule on or change its severity.
 */
export type EslintRuleOptions = PathExpressions & { scope: string; rules: NonNullable<EslintSettings['rules']> };

/**
 * What the block writer of one level and scope reads: the rule source, the all-level rules, the code files, your rule
 * options, and the scope folder.
 */
export type BlockWriter = {
    applied: Set<string>;
    allLevelRules: Set<string>;
    level: Level;
    codeFiles: string[];
    ruleOptions: EslintRuleOptions[];
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

/**
 * One eslint-plugin-boundaries dependency policy: the files it applies to, what they may or may not import, and its
 * message.
 */
export type EslintBoundaryPolicy = {
    from?: { file: EslintBoundaryFile | readonly EslintBoundaryFile[] };
    allow?: { to: { file: EslintBoundaryFile } };
    disallow?: {
        to: { file: EslintBoundaryFile };
        dependency?: { kind: 'value' };
    };
    message?: string;
};

/** The import rules and the test and tRPC paths that the boundary settings and dependency policies read. */
export type ScopeBoundaries = {
    importRules: Settings['import_rule'];
    enforceTests: boolean;
    hasFixedPolicies: boolean;
    tests: string[];
    trpcPaths: string[];
    /** The tRPC server files, which other files of a tRPC scope import only as types. */
    serverFiles: string[];
};

/** The `[tools.eslint]` table of one scope: its rules and path overrides. */
export type ScopeEslintSettings = { scope: string; settings: EslintSettings };

/** One runtime with readable include and exclude globs. */
export type EslintRuntime = PathExpressions & {
    scope: string;
    runtime: string;
};

/** A function selector names a component matcher or the index of a runtime declaration. */
export type EslintFileMatcher = string | { component: (typeof COMPONENT_CONFIGURATIONS)[number] } | { runtime: number };

/** The data part of one ESLint block, which the writer scopes and extends with your rule options. */
export type EslintBlockFields = {
    files?: readonly (EslintFileMatcher | EslintFileMatcher[])[];
    ignores?: string[];
    basePath?: string;
    rules?: Record<string, unknown>;
};

/** The component configurations, the detected Node.js files, and the test and script patterns of each scope. */
export type EslintFileGroups = {
    components: Configuration[];
    scopes: { scope: string; tests: string[]; scripts: string[] }[];
    nodeFiles: string[];
};

/** Shared file patterns for code, type-aware parsing, and test or script intersections. */
export type EslintFiles = {
    code: string[];
    typescript: string[];
    typed: (EslintFileMatcher | EslintFileMatcher[])[];
    javascript: string[];
    tests: string[][];
    scripts: string[][];
};

/** One captured block that omits executable parsers and plugin objects. */
type EslintPresetBlock = {
    parser: boolean;
    files?: (string | string[])[];
    ignores?: string[];
    basePath?: string;
    rules?: Record<string, JsonValue>;
};

/** One pinned preset, with at least one captured block. */
export type EslintPreset = {
    package: string;
    version: string;
    source: string;
    blocks: [EslintPresetBlock, ...EslintPresetBlock[]];
};

export type EslintPresets = Record<string, EslintPreset>;

/** The values and printers that the builders of configuration blocks share. */
export type PlannedEslintFile = {
    session: Session;
    scope: Scope;
    level: Level;
    nodeFiles: string[];
    projects: string[];
    ruleOptions: EslintRuleOptions[];
    blockWriter: BlockWriter;
    eslintFiles: EslintFiles;
    levelRules: EslintLevelRules;
    settingsBlocks: EslintRuleBlock[];
    allLevelRules: Set<string>;
    eslintPresets: Map<string, EslintPresets>;
    configurations: Configuration[];
};

/** The expression and captured values of rules supplied by a pinned preset. */
export type EslintRuleExpression = { expression: string; rules: Record<string, unknown> | undefined };

/** Rule values by source language and runtime use. */
export type EslintLevelRules = {
    code: Record<string, unknown>;
    javascript: Record<string, unknown>;
    node: Record<string, unknown>;
    console: Record<string, unknown>;
};

/** Imported plugin bindings paired with their package specifiers. */
export type EslintPlugins = Record<string, readonly [string, string]>;

/** The imports and blocks that one configuration adds to the ESLint file. */
export type ConfigurationBlocks = { imports: EslintPlugins; blocks: Omit<PlannedEslintBlock, 'scope' | 'label'>[] };

/** Relative-import enforcement with explicit project folders and import aliases. */
export type EslintImportBoundaryRule = [
    'error',
    { folders: string[]; aliases: Record<string, string>; externals?: string[] },
];

/** One block before the writer prints its scope and label. */
export type PlannedEslintBlock = {
    data: EslintBlockFields;
    properties?: string;
    preset?: EslintRuleExpression;
    scope?: { path: string; excluded: string[] };
    label: string;
};

/** The data one configuration uses to build its blocks. */
export type EslintScope = {
    scopePath: string;
    settings: ScopeSettings;
    eslintFiles: EslintFiles;
    presets: EslintPresets | undefined;
    eslintPresets: Map<string, EslintPresets>;
    scopeDependencies: string[];
    sourceFiles: string[];
    projects: string[];
};
