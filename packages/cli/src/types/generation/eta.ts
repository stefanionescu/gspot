import type { relative } from 'node:path/posix';
import type { Session } from '#cli/types/planning.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { ScopeEntry } from '#cli/types/repository/inventory.ts';
import type { PackageManifest } from '#cli/types/parsers/packages.ts';
import type { EditorconfigOverride } from '#cli/types/generation/formatting.ts';
import type { EslintPresets, EslintAllRules } from '#cli/types/parsers/eslint.ts';
import type { Policy, ScopeView, ScopeSelection } from '#cli/types/policy/settings.ts';

import type {
    EslintFiles,
    EslintModule,
    SelectorGroup,
    EslintRuleBlock,
    EslintConfiguration,
    EslintSettingsBlock,
} from '#cli/types/generation/eslint.ts';

/** Effective scope policy and declared project facts available to generated assets. */
export type ScopeEtaInputs = {
    session: Session;
    selection: ScopeSelection;
    manifests: Manifest[];
    projects: PackageManifest[];
};

export type EtaInputs = {
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
    targetPath?: string;
    /** The project's native environment name when its scope contains that directory. */
    pythonVenv: string | undefined;
    /** The scope source path relative to its native Python configuration. */
    pythonScopePath: string;
    /** Configuration-relative Python paths from the source inventory and ignores. */
    pythonExcludes: (check: string) => string[];
    scopeIgnorePatterns: (patterns: string[], scope: string) => string[];
    javascriptConfig: (targetPath: string) => Record<string, unknown>;
    prettierConfig: (targetPath: string) => Record<string, unknown>;
    editorconfigOverrides: () => EditorconfigOverride[];
    eslintPolicy: () => EslintRuleBlock[];
    eslintAllRules: EslintAllRules;
    isAll: boolean;
    /** Stable Ruff rules declared by the scope's frameworks and tools at the selected level. */
    ruffRules: string[];
    typescriptConfig: (targetPath: string) => Record<string, unknown>;
    prose: {
        packages: string[];
        blockIgnores: string[];
        tokenIgnores: string[];
        rules: string[];
        formats: [string, string][];
    };
    version: string;
    /** Compiler version authored in this scope’s native Swift project. */
    swiftVersion: () => string | undefined;
    scope: string;
    relative: typeof relative;
    scopes: Pick<ScopeEntry, 'path' | 'configurations'>[];
    /** Dependencies declared by the nearest npm project that contains this scope. */
    scopeDependencies: string[];
    configurationScopes: (configuration: string) => {
        path: string;
        settings: Record<string, unknown>;
        dependencies: string[];
        verbatim: ScopeView['verbatim'];
    }[];
    ignoredPaths: string[];
    configurations: string[];
    policy: Policy;
    format: ScopeView['format'];
    roles: ScopeView['roles'];
    settings: Record<string, unknown>;
    fragments: string;
    /** Separately emitted fragments for targets that consume structured configuration. */
    fragmentParts: string[];
    fragmentImports: string;
    fragmentFiles: string[];
    fragmentSelectors: SelectorGroup[];
    options: ScopeView['options'];
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
