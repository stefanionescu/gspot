import type { z } from 'zod';
import type { Node } from 'web-tree-sitter';
import type { Files } from '#cli/types/system.ts';
import type { Config } from '#cli/types/repository.ts';
import type { ScriptSyntax } from '#cli/types/parsers.ts';
import type { FENCE_GRAMMARS } from '#cli/config/parsers.ts';
import { type xccovSchema, type deptrySchema } from '#cli/schemas/configurations.ts';
import type { Session, GeneratedFile } from '#cli/types/tools.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { settingsSchema } from '#cli/schemas/settings/file.ts';
import type { Configuration, ParsedManifest } from '#cli/types/manifests.ts';
import type { MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import type { DOCSTRING_STYLES } from '#cli/config/configurations/registry.ts';
import type { COMPONENT_CONFIGURATIONS } from '#cli/config/configurations/javascript.ts';
import type { IgnoreSection, SourcedConfig } from '#cli/types/configurations/general.ts';
import type { Level, Scope, Defined, Settings, ScopeSettings, ParsedSettings } from '#cli/types/settings.ts';

export type SitemapUrls = { urls: URL[]; findings: CheckFinding[] };

export type SiteBuild = {
    root: string;
    cwd: string;
    command: string[];
    folder: string;
    built: boolean;
    failure: string;
};

export type PurgecssConstructor = new () => {
    purge(options: Record<string, unknown>): Promise<{ file?: string; rejected?: string[] }[]>;
};

export type PurgecssRequest = { config: string; css: string[]; content: string[] };

export type AssetSource = { path: string; text: string; matches: (path: string) => boolean };

export type AssetGlobImport = { patterns: string[]; text: string };

export type LayoutFinding = { line: number; rule: string; message: string };

export type ScriptFile = ScriptSyntax & {
    path: string;
    lines: string[];
    executable: boolean;
};

export type MarkupAttribute = { name: string; value: string; element: string; node: Node };

export type FormatFenceParser = 'json' | 'jsonc' | 'toml' | 'yaml';

export type GrammarFenceParser = (typeof FENCE_GRAMMARS)[number];

export type FenceParser = FormatFenceParser | GrammarFenceParser;

export type FenceSyntaxError = { line: number; message: string };

export type DeptryProject = z.infer<typeof deptrySchema>;

export type PydoclintOptions = { command: string[]; style: PythonDocstringStyle | undefined };

export type PythonDocstringStyle = (typeof DOCSTRING_STYLES)[number];

export type SwiftBuildPlan =
    | {
          kind: 'package';
          purpose: Exclude<SwiftBuildPurpose, 'periphery'>;
          folder: string;
          log: string;
          scratch: string;
          commandArguments: string[];
      }
    | {
          kind: 'xcode';
          purpose: Exclude<SwiftBuildPurpose, 'periphery'>;
          folder: string;
          log: string;
          commandArguments: string[];
      };

export type SwiftBuildOutput = { code: number; output: string; source: string };

export type SwiftBuildPurpose = 'compile' | 'analyze' | 'coverage' | 'periphery';

export type SwiftBuildSetup = { files: Files; source: string };

export type CoverageOutput = z.infer<typeof xccovSchema>;

export type MessageFiles = { folder: string; base: string; paths: ReadonlySet<string> };

export type ParsedMessage = { line: number; elements: MessageFormatElement[] | undefined; error: string | undefined };

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

type SvelteAttribute = { key?: { name?: string }; value: { value?: string }[] };

type ComponentElement<Attribute> = { type: string; name?: string; startTag: { attributes: Attribute[] } };

export type ComponentParser = {
    parseForESLint: (
        text: string,
        options: object,
    ) => {
        services?: { getDocumentFragment?: () => { children: ComponentElement<VueAttribute>[] } };
        ast: { body: ComponentElement<SvelteAttribute>[] };
    };
};

type EslintSettings = NonNullable<NonNullable<WrittenSettings['tools']>['eslint']>;

type EslintBoundaryFile = {
    path?: string | readonly string[];
    categories?: string | { anyOf?: readonly string[]; noneOf?: readonly string[] };
    isUnknown?: boolean;
};

export type PathExpressions = { includes: string[]; excludes: string[] };

export type BashCommandForm = {
    rule: string;
    message: string;
    present?: readonly RegExp[];
    absent?: RegExp;
    allLevel?: true;
};

export type SelectorPaths = Pick<ParsedManifest['eslint']['selectors'][number], 'selector' | 'message'> & {
    files?: string[];
    ignores?: string[];
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

export type SelectorBlock = { scope: string; ignoredScopes: string[]; selectors: SelectorPaths[] };

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
    defaultProjectFiles: string[];
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
    level: Level;
    projectPath: string;
    path: string;
    settings: ScopeSettings;
    eslintFiles: EslintFiles;
    dependencies: string[];
    sourceFiles: string[];
    projects: string[];
    defaultProjectFiles: string[];
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
    allLevelRules?: Readonly<Record<string, unknown>>;
};

export type ConfigOwner = { session: Session; scope: Scope; configuration: Configuration };

export type PlannedConfig = ConfigOwner & {
    ignoreSections: IgnoreSection[];
    targetPath: string;
    level: Level;
    config: SourcedConfig;
};

export type ConfigOutput = { content: string; companions: GeneratedFile[] };

export type StylelintComponent = {
    files: readonly string[];
    customSyntax: string;
    ignorePseudoClasses: readonly string[];
    functions?: readonly string[];
};

export type OwnedConfig = { config: Config; owner: ConfigOwner };

export type FormatSettings = Required<Defined<Omit<NonNullable<ParsedSettings['format']>, 'override' | 'quotes'>>> &
    Pick<NonNullable<ParsedSettings['format']>, 'quotes'>;

export type MarkdownlintFormatterInput = { results: unknown; logMessage: (message: string) => void };

export type WrittenSettings = z.input<typeof settingsSchema>;
