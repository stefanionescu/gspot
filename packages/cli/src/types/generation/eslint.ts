import type { EslintAllRules } from '#cli/types/parsers/eslint.ts';
import type { PathExpressions } from '#cli/types/repository/inventory.ts';
import type { Policy, RawPolicy, ScopeSelection } from '#cli/types/policy/settings.ts';

export type EslintRuleBlock = PathExpressions & { scope: string; rules: Record<string, unknown> };

/** Authored native options never declare rule severity or coverage. */
export type EslintRuleOptions = PathExpressions & { scope: string; rules: NonNullable<EslintSettings['rules']> };

/** Generated rule blocks retain their level, project bounds, and authored native options. */
export type EslintModuleInput = {
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
    files?: string[];
    selectors: { selector: string; message: string }[];
};

/** The `[tools.eslint]` table of gspot.toml. */
export type EslintSettings = NonNullable<NonNullable<RawPolicy['tools']>['eslint']>;

/** One block of the generated ESLint configuration: the files it covers and what it sets for them. */
export type EslintBlock = {
    files: (string | string[])[];
    ignores?: string[];
    settings?: Record<string, unknown>;
    rules?: Record<string, unknown>;
};

/** What the ESLint configuration reads: the repository root, the policy, every scope, and the scope being rendered. */
export type EslintContext = { root: string; policy: Policy; scopes: ScopeSelection[]; selection: ScopeSelection };

/** The parts of the ESLint configuration that the policy and the rendered scope decide. */
export type EslintConfiguration = {
    aliases: Record<string, string>;
    testFiles: string[];
    scriptFiles: string[];
    limits: Record<string, number | undefined>;
    javascriptLimits: Record<string, number | undefined>;
    gspotRules: Record<string, unknown>;
    importLayoutRules: Record<string, unknown>;
    commentLevel: 'error' | 'off';
    importStyleBlocks: EslintBlock[];
    runtimes: EslintRuntimeBlock[];
    boundaryBlocks: EslintBlock[];
    scopeBlocks: EslintBlock[];
    ignoredPaths: string[];
    restrictedImports: unknown[];
    verbatim: { reason: unknown; entries: Record<string, unknown> } | undefined;
};

/** Rules authored for one repository scope. */
export type ScopeEslintSettings = { scope: string; settings: EslintSettings };

/** One scoped runtime declaration, using the repository selector contract. */
export type EslintRuntimeBlock = PathExpressions & {
    scope: string;
    runtime: string;
    nodeVersion?: string;
};

/** A function selector retains the exact declarations that generate it. */
export type EslintFileSelector =
    | string
    | { runtime: { declarations: EslintRuntimeBlock[]; index: number } }
    | { scope: { scope: string; includes: string[]; excludes: string[]; flags: string } };

/** Serializable rule fields shared by rendering and the last successful apply baseline. */
export type EslintSettingsBlock = {
    files?: (EslintFileSelector | EslintFileSelector[])[];
    ignores?: string[];
    basePath?: string;
    rules?: Record<string, unknown>;
};

/** The actual default blocks and a renderer bound to the owning scope. */
export type EslintModule = {
    blocks: EslintSettingsBlock[];
    block: (block: EslintSettingsBlock, runtime?: string) => string;
};

/** Shared file patterns for code, type-aware parsing, and test or script intersections. */
export type EslintFiles = {
    code: string[];
    typescriptSource: string[];
    typescript: string[];
    javascript: string[];
    tests: string[][];
    scripts: string[][];
};

/** Configuration name, preset name, installed package, and exact public export path. */
export type EslintPresetSources = Record<string, Record<string, readonly [string, string]>>;
