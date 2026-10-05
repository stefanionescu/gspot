import type { EditorconfigOverride } from '#cli/types/generation/formatting.ts';
import type { EslintPresets, EslintAllRules } from '#cli/types/parsers/eslint.ts';
import type { Policy, ScopeView, PolicyScope } from '#cli/types/policy/settings.ts';

import type {
    EslintFiles,
    EslintModule,
    SelectorGroup,
    EslintRuleBlock,
    EslintConfiguration,
    EslintSettingsBlock,
} from '#cli/types/generation/eslint.ts';

export type TemplateInputs = {
    /** Present for a configuration whose manifest declares rule paths. */
    recordRules?: (document: unknown) => void;
    /** The parts of the ESLint configuration the policy decides, computed when that template renders. */
    eslint: () => EslintConfiguration;
    eslintModule: EslintModule;
    eslintFiles: EslintFiles;
    eslintFragmentBlocks: EslintSettingsBlock[];
    eslintPresets: (configuration: string) => EslintPresets;
    eslintRuleSettings: (blocks: EslintSettingsBlock[]) => { rules: Record<string, unknown[]> };
    eslintErrorRules: (rules: Record<string, unknown>) => Record<string, unknown>;
    serializeEslintBlock: (block: EslintSettingsBlock, runtime?: string) => string;
    targetPath?: string;
    scopeIgnorePatterns: (patterns: string[], scope: string) => string[];
    javascriptConfig: (targetPath: string) => Record<string, unknown>;
    prettierConfig: (targetPath: string) => Record<string, unknown>;
    editorconfigOverrides: () => EditorconfigOverride[];
    eslintPolicy: () => EslintRuleBlock[];
    eslintAllRules: EslintAllRules;
    isAll: boolean;
    /** Stable Ruff rules declared by the scope's frameworks and tools at the selected level. */
    ruffRules: string[];
    typescriptOptions: Record<string, boolean>;
    prose: { blockIgnores: string[]; tokenIgnores: string[]; rules: string[]; formats: [string, string][] };
    version: string;
    scope: string;
    scopes: PolicyScope[];
    configurationScopes: (configuration: string) => {
        path: string;
        settings: Record<string, unknown>;
        verbatim: ScopeView['verbatim'];
        /** The first harness folder of the scope, relative to it, when the policy names one. */
        harness: string | undefined;
    }[];
    configurations: string[];
    policy: Policy;
    format: ScopeView['format'];
    settings: Record<string, unknown>;
    fragments: string;
    fragmentImports: string;
    fragmentFiles: string[];
    fragmentSelectors: SelectorGroup[];
    options: (name: string) => Record<string, unknown>;
    entryFiles: (scope: string) => string[];
    limit: (key: string, language?: string) => number | undefined;
    rulesOff: (check: string) => string[];
    ignoresFor: ScopeView['ignoresFor'];
    verbatim: (name: string) => Record<string, unknown> | undefined;
    json: (value: unknown, indent?: number) => string;
    toml: (value: Record<string, unknown>) => string;
    yaml: (value: Record<string, unknown>) => string;
    tomlDate: new (value: string) => Date;
    files: (extension: string) => string[];
    /** The folders of the npm package workspaces, read when a template asks. */
    packageWorkspaces: () => string[];
    /** The executable names declared by applicable tool requirements. */
    toolBinaries: string[];
    /** The npm packages required by applicable checks and generated config files. */
    toolPackages: string[];
};
