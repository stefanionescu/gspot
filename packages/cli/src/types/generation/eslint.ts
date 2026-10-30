import type { Session } from '#cli/types/session.ts';
import type { Settings, WrittenSettings } from '#cli/types/settings/file.ts';
import type { Scope, ScopeSettings } from '#cli/types/settings/inheritance.ts';
import type { Level, Configuration, ParsedManifest } from '#cli/types/manifests.ts';
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
    runtimes?: EslintRuntime[];
    allLevelRules: Set<string>;
    level: Level;
    codeFiles: string[];
    ruleOptions: EslintRuleOptions[];
};

export type SelectorBlock = {
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

type EslintFileMatcher = string | { component: (typeof COMPONENT_CONFIGURATIONS)[number] } | { runtime: number };

export type EslintBlockFields = {
    [field: string]: unknown;
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

export type PlannedEslintFile = {
    session: Session;
    scope: Scope;
    nodeFiles: string[];
    projects: string[];
    blockWriter: BlockWriter;
    eslintFiles: EslintFiles;
    levelRules: EslintLevelRules;
    configurations: Configuration[];
};

type EslintPresetSource = { importName: string; path: string; merge: 'fields' | 'rules' | 'spread' };

export type EslintCallArgument =
    | { importName: string; path?: string }
    | { value: unknown }
    | { imports: Readonly<Record<string, string | readonly [string, string]>> };

type EslintCall = { name: string; args: readonly EslintCallArgument[] };

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
    calls?: readonly EslintCall[];
    presets?: EslintPresetSource[];
    scope?: { path: string; excluded: string[] };
    label: string;
};

export type EslintScope = {
    projectPath: string;
    path: string;
    settings: ScopeSettings;
    eslintFiles: EslintFiles;
    dependencies: string[];
    sourceFiles: string[];
    projects: string[];
};

export type ConfigurationBuilder = (scope: EslintScope, configuration: string) => ConfigurationBlocks;

export type ConfigurationScopeBlocks = {
    configuration: Configuration;
    imports: EslintPlugins;
    blocks: PlannedEslintBlock[];
};

export type PluginRuleBlock = {
    fields?: EslintBlockFields;
    imports: EslintPlugins;
    calls: readonly EslintCall[];
    files: 'code' | 'tests' | readonly string[];
    ignoresTests?: true;
    rules: Readonly<Record<string, unknown>>;
};
