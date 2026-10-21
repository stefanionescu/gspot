import type { Session } from '#cli/types/planning.ts';
import type { JsonValue } from '#cli/types/parsers/json.ts';
import type { WrittenSettings } from '#cli/types/settings/file.ts';
import type { PathExpressions } from '#cli/types/repository/inventory.ts';
import type { COMPONENT_CONFIGURATIONS } from '#cli/config/generation/eslint.ts';
import type { Settings, ScopeView, ScopeSelection } from '#cli/types/settings/values.ts';
import { type Level, type Manifest, type EslintAllRules } from '#cli/types/configurations.ts';

/** The `[tools.eslint]` table of gspot.toml. */
type EslintSettings = NonNullable<NonNullable<WrittenSettings['tools']>['eslint']>;

/** File selectors used by the composed architecture and tRPC policies. */
type EslintBoundaryFile = {
    path?: string | readonly string[];
    categories?: string | { anyOf?: readonly string[]; noneOf?: readonly string[] };
    isUnknown?: boolean;
};

/** One captured block that omits executable parsers and plugin objects. */
type EslintPresetBlock = {
    parser: boolean;
    files?: (string | string[])[];
    ignores?: string[];
    basePath?: string;
    rules?: Record<string, JsonValue>;
};

export type EslintRuleBlock = PathExpressions & { scope: string; rules: Record<string, unknown> };

/** Your own rule options do not choose rule severity or whether a rule runs. */
export type EslintRuleOptions = PathExpressions & { scope: string; rules: NonNullable<EslintSettings['rules']> };

/** Generated rule blocks retain their level, project paths, and your own options. */
export type BlockWriterInput = {
    applied: Set<string>;
    allRules: EslintAllRules;
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

/** Module dependency restrictions apply before the tRPC value restriction. */
export type EslintBoundaryPolicy = {
    from?: { file: EslintBoundaryFile | readonly EslintBoundaryFile[] };
    allow?: { to: { file: EslintBoundaryFile } };
    disallow?: {
        to: { file: EslintBoundaryFile };
        dependency?: { kind: 'value' };
    };
    message?: string;
};

/** Classification data shared by the settings and dependency settings constructors. */
export type EslintBoundaryContext = {
    importRules: Settings['import_rule'];
    enforceTests: boolean;
    hasFixedPolicies: boolean;
    tests: string[];
    trpcPaths: string[];
    /** The tRPC server files, which other files of a tRPC scope import only as types. */
    serverFiles: string[];
};

/** Your own rules for one repository scope. */
export type ScopeEslintSettings = { scope: string; settings: EslintSettings };

/** One runtime declaration with readable include and exclude globs. */
export type EslintRuntimeBlock = PathExpressions & {
    scope: string;
    runtime: string;
};

/** A function selector names a component matcher or the index of a runtime declaration. */
export type EslintFileSelector =
    | string
    | { component: (typeof COMPONENT_CONFIGURATIONS)[number] }
    | { runtime: number };

/** Serializable rule fields that generation and the baseline of the last apply share. */
export type EslintSettingsBlock = {
    files?: readonly (EslintFileSelector | EslintFileSelector[])[];
    ignores?: string[];
    basePath?: string;
    rules?: Record<string, unknown>;
};

/** Component patterns, detected Node files, and your test or script patterns. */
export type EslintFileInputs = {
    components: Manifest[];
    scopes: { scope: string; tests: string[]; scripts: string[] }[];
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

/** One pinned preset, with at least one captured block. */
export type EslintPreset = {
    package: string;
    version: string;
    source: string;
    blocks: [EslintPresetBlock, ...EslintPresetBlock[]];
};

export type EslintPresets = Record<string, EslintPreset>;

/** Inputs and printers shared by the ESLint fragment builders. */
export type EslintContext = {
    session: Session;
    selection: ScopeSelection;
    level: Level;
    nodeFiles: string[];
    projects: string[];
    ruleOptions: EslintRuleOptions[];
    blockInput: BlockWriterInput;
    eslintFiles: EslintFiles;
    levelRules: EslintLevelRules;
    settingsBlocks: EslintRuleBlock[];
    eslintAllRules: Set<string>;
    eslintPresets: Map<string, EslintPresets>;
    configurations: Manifest[];
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

/** The imports and blocks that one ESLint fragment produces. */
export type EslintFragment = { imports: EslintPlugins; blocks: Omit<EslintBlockInput, 'scope' | 'label'>[] };

/** Relative-import enforcement with explicit project folders and import aliases. */
export type EslintImportBoundaryRule = [
    'error',
    { folders: string[]; aliases: Record<string, string>; externals?: string[] },
];

/** One block before the writer prints its scope and label. */
export type EslintBlockInput = {
    data: EslintSettingsBlock;
    properties?: string;
    preset?: EslintRuleExpression;
    scope?: { path: string; excluded: string[] };
    label: string;
};

/** The data one configuration uses to build its blocks. */
export type EslintFragmentContext = {
    scope: string;
    view: ScopeView;
    eslintFiles: EslintFiles;
    presets: EslintPresets | undefined;
    eslintPresets: Map<string, EslintPresets>;
    scopeDependencies: string[];
    sourceFiles: string[];
    projects: string[];
};
