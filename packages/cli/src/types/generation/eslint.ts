import type { Session } from '#cli/types/session.ts';
import type { JsonValue } from '#cli/types/shapes.ts';
import type { Settings, WrittenSettings } from '#cli/types/settings/file.ts';
import type { Scope, ScopeSettings } from '#cli/types/settings/inheritance.ts';
import type { Level, Configuration, ParsedManifest } from '#cli/types/configurations.ts';
import type { COMPONENT_CONFIGURATIONS } from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';

type EslintSettings = NonNullable<NonNullable<WrittenSettings['tools']>['eslint']>;

type EslintBoundaryFile = {
    path?: string | readonly string[];
    categories?: string | { anyOf?: readonly string[]; noneOf?: readonly string[] };
    isUnknown?: boolean;
};

export type PathExpressions = { includes: string[]; excludes: string[] };

export type SelectorPaths = Pick<ParsedManifest['eslint']['selectors'][number], 'selector' | 'message'> & {
    files?: string[];
    except?: string[];
};

export type EslintRuleBlock = PathExpressions & { scope: string; rules: Record<string, unknown> };

export type EslintRuleOptions = PathExpressions & { scope: string; rules: NonNullable<EslintSettings['rules']> };

export type BlockWriter = {
    applied: Set<string>;
    allLevelRules: Set<string>;
    level: Level;
    codeFiles: string[];
    ruleOptions: EslintRuleOptions[];
};

export type SelectorGroup = {
    scope?: string;
    ignoredScopes?: string[];
    files?: (string | string[])[];
    ignores?: string[];
    selectors: { selector: string; message: string }[];
};

export type EslintBlock = {
    files: (string | string[])[];
    ignores?: string[];
    settings?: Record<string, unknown>;
    rules?: Record<string, unknown>;
};

export type EslintBoundaryPolicy = {
    from?: { file: EslintBoundaryFile | readonly EslintBoundaryFile[] };
    allow?: { to: { file: EslintBoundaryFile } };
    disallow?: {
        to: { file: EslintBoundaryFile };
        dependency?: { kind: 'value' };
    };
    message?: string;
};

export type ScopeBoundaries = {
    importRules: Settings['import_rule'];
    enforceTests: boolean;
    hasFixedPolicies: boolean;
    tests: string[];
    trpcPaths: string[];
    serverFiles: string[];
};

export type ScopeEslintSettings = { scope: Scope; settings: EslintSettings };

export type EslintRuntime = PathExpressions & {
    scope: string;
    runtime: string;
};

export type EslintFileMatcher = string | { component: (typeof COMPONENT_CONFIGURATIONS)[number] } | { runtime: number };

export type EslintBlockFields = {
    files?: readonly (EslintFileMatcher | EslintFileMatcher[])[];
    ignores?: string[];
    basePath?: string;
    rules?: Record<string, unknown>;
};

export type EslintFileGroups = {
    components: Configuration[];
    scopes: { scope: string; tests: string[]; scripts: string[] }[];
    nodeFiles: string[];
};

export type EslintFiles = {
    code: string[];
    typescript: string[];
    typed: (EslintFileMatcher | EslintFileMatcher[])[];
    javascript: string[];
    tests: string[][];
    scripts: string[][];
};

type EslintPresetBlock = {
    parser: boolean;
    files?: (string | string[])[];
    ignores?: string[];
    basePath?: string;
    rules?: Record<string, JsonValue>;
};

export type EslintPreset = {
    package: string;
    version: string;
    source: string;
    blocks: [EslintPresetBlock, ...EslintPresetBlock[]];
};

export type EslintPresets = Record<string, EslintPreset>;

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

export type EslintRuleExpression = { expression: string; rules: Record<string, unknown> | undefined };

export type EslintLevelRules = {
    code: Record<string, unknown>;
    javascript: Record<string, unknown>;
};

export type EslintPlugins = Record<string, readonly [string, string]>;

export type ConfigurationBlocks = { imports: EslintPlugins; blocks: Omit<PlannedEslintBlock, 'scope' | 'label'>[] };

export type EslintImportBoundaryRule = [
    'error',
    { folders: string[]; aliases: Record<string, string>; externals?: string[] },
];

export type PlannedEslintBlock = {
    fields: EslintBlockFields;
    properties?: string;
    preset?: EslintRuleExpression;
    scope?: { path: string; excluded: string[] };
    label: string;
};

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
