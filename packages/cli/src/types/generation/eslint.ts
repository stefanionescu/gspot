import type { Manifest } from '#cli/types/configurations.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
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
    files?: (string | string[])[];
    ignores?: string[];
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

/** Native file selectors used by the composed architecture and tRPC policies. */
export type EslintBoundaryFile = {
    path?: string | string[];
    categories?: string | { anyOf?: string[]; noneOf?: string[] };
    isUnknown?: boolean;
};

/** Native dependency effects preserve authored architecture policies before the tRPC value restriction. */
export type EslintBoundaryPolicy = {
    from?: { file: EslintBoundaryFile | EslintBoundaryFile[] };
    allow?: { to: { file: EslintBoundaryFile } };
    disallow?: { to: { file: EslintBoundaryFile }; dependency: { kind: 'value' } };
};

/** Native dependency selectors classify declaration and per-specifier type imports. */
export type EslintDependencyNode = { selector: string; kind: 'type' | 'value'; name: string };

/** Repository policy, resolved scopes, and authored Node paths used by native ESLint generation. */
export type EslintContext = {
    root: string;
    reads: ReadCache;
    policy: Policy;
    scopes: ScopeSelection[];
    selection: ScopeSelection;
    nodeFiles: string[];
};

/** The parts of the ESLint configuration that the policy and the emitted scope decide. */
export type EslintConfiguration = {
    aliases: Record<string, string>;
    nodeFiles: string[];
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
    verbatim: { reason: string | undefined; entries: Record<string, unknown> } | undefined;
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
    | { component: 'vue' | 'svelte' }
    | { runtime: { declarations: EslintRuntimeBlock[]; index: number } }
    | { scope: { scope: string; includes: string[]; excludes: string[]; flags: string } };

/** Serializable rule fields shared by emission and the last successful apply baseline. */
export type EslintSettingsBlock = {
    files?: (EslintFileSelector | EslintFileSelector[])[];
    ignores?: string[];
    basePath?: string;
    rules?: Record<string, unknown>;
};

/** The actual default blocks and an emitter bound to the owning scope. */
export type EslintModule = {
    blocks: EslintSettingsBlock[];
    block: (block: EslintSettingsBlock, runtime?: string) => string;
};

/** Selected component patterns, detected Node files, and authored test or script patterns. */
export type EslintFileInputs = {
    components: Manifest[];
    tests: string[];
    scripts: string[];
    nodeFiles: string[];
};

/** Shared file patterns for code, type-aware parsing, and test or script intersections. */
export type EslintFiles = {
    code: string[];
    fragmentFiles: string[];
    typescriptSource: string[];
    typescript: (EslintFileSelector | EslintFileSelector[])[];
    javascript: string[];
    tests: string[][];
    scripts: string[][];
};

/** Configuration name, preset name, installed package, and exact public export path. */
export type EslintPresetSources = Record<string, Record<string, readonly [string, string]>>;
