// The types of generation in this package.
import type { PackageTool } from '#cli/types/tools/packages.ts';
import type { HOOK_FILES } from '#cli/config/generation/generation.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';
import type { EditorconfigOverride } from '#cli/types/generation/formatting.ts';
import type { Policy, MergedView, ScopeSelection } from '#cli/types/policy/policy.ts';
import type { Manifest, RawManifest, GeneratedFile, ConfigurationTarget } from '#cli/types/kits.ts';
import type { SelectorGroup, EslintRuleBlock, EslintConfiguration } from '#cli/types/generation/eslint.ts';

type BlockOutput = { path: string; block: string; style: 'markdown' | 'hash' };
export type Fragment = { manifest: Manifest; config: ConfigurationTarget };
export type Pipeline = {
    version: string;
    run?: NonNullable<Policy['ci']>['run'];
    platforms: string[];
    /** The Swift scope path, or undefined when no scope selects swift. */
    swiftScope: string | undefined;
    isMise: boolean;
    /** The manual checks the selected kits declare, which the manual job runs by name. */
    manualChecks: string[];
};
export type TemplateInputs = {
    /** The parts of the ESLint configuration the policy decides, computed when that template renders. */
    eslint: () => EslintConfiguration;
    markdownlintRules: Record<string, unknown>;
    targetPath?: string;
    scopeIgnorePatterns: (patterns: string[], scope: string) => string[];
    javascriptConfig: (targetPath: string) => Record<string, unknown>;
    prettierConfig: (targetPath: string) => Record<string, unknown>;
    editorconfigOverrides: () => EditorconfigOverride[];
    eslintPolicy: EslintRuleBlock[];
    eslintRuleLevels: Record<string, 'recommended' | 'all'>;
    isAll: boolean;
    typescriptOptions: Record<string, boolean>;
    prose: { blockIgnores: string[]; tokenIgnores: string[]; styles: string[]; formats: [string, string][] };
    version: string;
    scope: string;
    scopes: { path: string; kits: string[] }[];
    kitScopes: (kit: string) => {
        path: string;
        settings: Record<string, unknown>;
        extra: MergedView['extra'];
        /** The first harness folder of the scope, relative to it, when the policy names one. */
        harness: string | undefined;
    }[];
    kits: string[];
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
    /** The folders of the npm package workspaces, read when a template asks. */
    packageWorkspaces: () => string[];
    tools: string[];
    /** The npm package of every selected tool that has one. */
    toolPackages: string[];
    header: string;
    headerLines: string[];
};

export type ConfigurationOutput = {
    path: string;
    format: ConfigurationFormat;
    changes: { path: (string | number)[]; value: unknown }[];
};
export type Generated = {
    notes: string[];
    files: GeneratedFile[];
    blocks: BlockOutput[];
    merges: ConfigurationOutput[];
    configurations: ConfigurationOutput[];
};

/** A fragment selector with the allowed setting replaced by the paths it holds. */
export type ResolvedSelector = Pick<FragmentSelector, 'selector' | 'message' | 'files'> & { except?: string[] };

export type GenerationOptions = { version: string; packageClient: PackageTool | undefined };
export type JsonFormat = { width: number; indent: number };
export type HookName = (typeof HOOK_FILES)[number];
export type Pointer = NonNullable<ConfigurationTarget['pointer']>;

/** What emitting one manifest in one scope needs. */
export type EmitInputs = {
    root: string;
    files: TrackedFile[];
    scopes: ScopeSelection[];
    inputs: TemplateInputs;
    selection: ScopeSelection;
    manifest: Manifest;
};

export type FragmentSelector = RawManifest['configs'][number]['selectors'][number];
export type PointerSpec = NonNullable<ConfigurationTarget['pointer']>;

export type BlockStyle = 'markdown' | 'hash';
export type BlockSpan = { start: number; end: number };

export type ConfigurationFormat = 'json' | 'yaml' | 'toml';
