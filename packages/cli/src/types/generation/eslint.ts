// The types of generation/eslint in this package.
import type { PathExpressions } from '#cli/types/repository/repository.ts';
import type { Policy, RawPolicy, ScopeSelection } from '#cli/types/policy/policy.ts';

export type EslintRuleBlock = PathExpressions & { scope: string; rules: Record<string, unknown> };

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
    nodeVersion: string;
    limits: Record<string, number | undefined>;
    javascriptLimits: Record<string, number | undefined>;
    gspotRules: Record<string, unknown>;
    importLayoutRules: Record<string, unknown>;
    commentLevel: 'error' | 'off';
    importStyleBlocks: EslintBlock[];
    runtimes: { files: string[]; runtime: string }[];
    boundaryBlocks: EslintBlock[];
    scopeBlocks: EslintBlock[];
    ignoredPaths: string[];
    restrictedImports: unknown[];
    extra: { reason: unknown; entries: Record<string, unknown> } | undefined;
};

/** One no-restricted-syntax rule: its file set, or every code file when absent, and the selectors it holds. */
export type SelectorGroup = {
    scope?: string;
    ignoredScopes?: string[];
    files?: string[];
    selectors: { selector: string; message: string }[];
};

/** ESLint settings retain the validation shape of their policy owner. */
export type EslintSettings = NonNullable<NonNullable<RawPolicy['tools']>['eslint']>;
