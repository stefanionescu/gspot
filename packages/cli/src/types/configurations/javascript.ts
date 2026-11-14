import type { Session } from '#cli/types/tools.ts';
import type { DependencyFile } from '#cli/types/parsers.ts';
import type { Configuration, ParsedManifest } from '#cli/types/manifests.ts';
import type { COMPONENT_CONFIGURATIONS } from '#cli/config/configurations/javascript/projects.ts';
import type { Level, Scope, Settings, ScopeSettings, WrittenSettings } from '#cli/types/settings.ts';

export type EslintGlobals = Record<string, boolean | 'readonly' | 'writable' | 'writeable' | 'off'>;

export type JavascriptBlock = {
    files?: unknown[];
    ignores?: string[];
    rules?: Record<string, unknown>;
    plugins?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    languageOptions?: { globals?: EslintGlobals; [option: string]: unknown };
    [field: string]: unknown;
};

export type EslintRuleOptionBlock = { paths: unknown[][]; ignores: string[]; rules: Record<string, unknown[]> };

type VueAttribute = { key?: { name?: string }; value?: { value?: string } | null };

type SvelteAttribute = { key?: { name?: string }; value: Array<{ value?: string }> };

type ComponentElement<Attribute> = { type: string; name?: string; startTag: { attributes: Attribute[] } };

export type ComponentParser = {
    parseForESLint: (
        text: string,
        options: object,
    ) => {
        services?: { getDocumentFragment?: () => { children: Array<ComponentElement<VueAttribute>> } };
        ast: { body: Array<ComponentElement<SvelteAttribute>> };
    };
};

type EslintSettings = NonNullable<NonNullable<WrittenSettings['tools']>['eslint']>;

type EslintBoundaryFile = {
    path?: string | readonly string[];
    categories?: string | { anyOf?: readonly string[]; noneOf?: readonly string[] };
    isUnknown?: boolean;
};

export type PathExpressions = { includes: string[]; excludes: string[] };

export type SelectorPaths = Pick<ParsedManifest['eslint']['selectors'][number], 'selector' | 'message'> & {
    files?: string[];
    ignores?: string[];
};

export type EslintRuleBlock = PathExpressions & { scopePath: string; rules: Record<string, unknown> };

export type EslintRuleOptions = PathExpressions & { scopePath: string; rules: NonNullable<EslintSettings['rules']> };

export type BlockWriter = {
    runtimes: EslintRuntime[];
    rulePrefixes: ReadonlyMap<string, string | undefined>;
    sharedLists: ReadonlyMap<string, string>;
    allLevelRules: Set<string>;
    level: Level;
    codeFiles: string[];
    ruleOptions: EslintRuleOptions[];
};

export type EslintFileWriter = BlockWriter & {
    functions: Set<string>;
    packages: Set<string>;
    modules: Map<string, string>;
    constants: Map<string, string>;
};

export type SelectorBlock = { scopePath: string; ignoredScopes: string[]; selectors: SelectorPaths[] };

export type EslintBlock = {
    files: Array<string | string[]>;
    ignores?: string[];
    settings?: Record<string, unknown>;
    rules?: Record<string, unknown>;
};

export type EslintBoundaryPolicy = {
    from?: { file: EslintBoundaryFile | readonly EslintBoundaryFile[] };
    allow?: { to: { file: EslintBoundaryFile } } | { dependency: { source: string[] } };
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
    externals: string[];
};

export type ScopeEslintSettings = { scope: Scope; settings: EslintSettings };

export type EslintRuntime = PathExpressions & {
    scopePath: string;
    runtime: string;
};

type EslintFileMatcher = string | { component: (typeof COMPONENT_CONFIGURATIONS)[number] } | { runtime: number };

export type EslintBlockFields = {
    [field: string]: unknown;
    files?: ReadonlyArray<EslintFileMatcher | EslintFileMatcher[]>;
    ignores?: string[];
    rules?: Record<string, unknown>;
};

export type EslintFileGroups = {
    components: Configuration[];
    scopes: Array<{ scopePath: string; tests: string[]; scripts: string[] }>;
    nodeFiles: string[];
};

export type EslintFiles = {
    code: string[];
    typescript: string[];
    typed: Array<EslintFileMatcher | EslintFileMatcher[]>;
    javascript: string[];
    tests: string[][];
    scripts: string[][];
};

export type PlannedEslintFile = {
    session: Session;
    scope: Scope;
    nodeFiles: string[];
    projects: string[];
    defaultProjectFiles: string[];
    blockWriter: BlockWriter;
    eslintFiles: EslintFiles;
    languageRules: EslintLanguageRules;
    configurations: Configuration[];
};

export type EslintReference = { package: string; path?: string };

type EslintPresetSource = EslintReference & { merge: 'fields' | 'rules' };

export type ListedPlugins = { plugins: ReadonlyArray<string | EslintReference>; local: EslintPlugins };

export type EslintCallArgument = EslintReference | ListedPlugins | Pick<ListedPlugins, 'plugins'> | { value: unknown };

type EslintCall = { name: string; args: readonly EslintCallArgument[] };

export type EslintLanguageRules = {
    code: Record<string, unknown>;
    javascript: Record<string, unknown>;
};

export type EslintPlugins = Record<string, readonly [string, string]>;

export type ConfigurationBlocks = Array<Omit<PlannedEslintBlock, 'scope'>>;

export type EslintImportBoundaryRule = [
    'error',
    { folders: string[]; aliases: Record<string, string>; externals?: string[] },
];

export type PlannedEslintBlock = {
    fields: EslintBlockFields;
    calls?: readonly EslintCall[];
    presets?: EslintPresetSource[];
    scope?: { path: string; excluded: string[] };
};

export type EslintScope = {
    level: Level;
    path: string;
    settings: ScopeSettings;
    eslintFiles: EslintFiles;
    dependencies: string[];
    dependencyFiles: DependencyFile[];
    sourceFiles: string[];
    projects: string[];
    defaultProjectFiles: string[];
};

export type EslintBlockBuilder = (scope: EslintScope) => ConfigurationBlocks;

export type ConfigurationScopeBlocks = { configuration: Configuration; blocks: PlannedEslintBlock[] };

export type PluginRuleBlock = {
    fields?: EslintBlockFields;
    calls?: readonly EslintCall[];
    presets?: EslintPresetSource[];
    files: 'code' | 'tests' | readonly string[];
    ignoresTests?: true;
    rules?: Readonly<Record<string, unknown>>;
    allLevelRules?: Readonly<Record<string, unknown>>;
};

export type ScopeOverride<Value, Block> = {
    base?: Scope;
    read: (scope: Scope) => Value;
    build: (change: { scope: Scope; parent: Scope | undefined; value: Value; ignores: string[] }) => Block[];
};

export type ListCounts = Map<string, { key: string; count: number }>;

export type EslintRuleReport = {
    data?: Record<string, unknown>;
    fix?: (fixer: unknown) => Array<{ text: string; [field: string]: unknown }> | undefined;
    [field: string]: unknown;
};

export type EslintRuleContext = { options: unknown[]; report: (report: EslintRuleReport) => void };

export type EslintRuleModule = { create: (context: EslintRuleContext) => unknown; [field: string]: unknown };

export type EslintUnicornPlugin = {
    rules: Record<'consistent-boolean-name' | 'no-asterisk-prefix-in-documentation-comments', EslintRuleModule> &
        Record<string, EslintRuleModule>;
    configs: Record<string, JavascriptBlock>;
    [field: string]: unknown;
};
