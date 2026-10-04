import type { TSESTree } from '@typescript-eslint/utils';

/** Parsed dependency modules and ancestor paths used by one barrel rule evaluation. */
export type ExportSources = { modules: Map<string, TSESTree.Program>; ancestors: Set<string> };

export type HelpersBesideTestsOptions = [{ harness?: string }];

export type ImportExtensionsName = 'js' | 'ts' | 'extensionless';

export type ImportExtensionsOptions = [{ style?: ImportExtensionsName; internalPrefixes?: string[] }];

export type InstancesInRegistryOptions = [{ files?: string[] }];

export type ClientEnvOptions = [{ isClient?: boolean; publicPrefixes?: string[]; allowed?: string[] }];

export type CrossScopeImportsOptions = [{ scopes?: string[] }];

export type ImportDirectionRoles = {
    types?: string[];
    tests?: string[];
    harness?: string[];
    config?: string[];
    env?: string[];
    runtime?: string[];
};

export type ImportDirectionRole = 'types' | 'tests' | 'harness' | 'config' | 'env' | 'runtime' | 'other';

/** A resolved import path and its configured architecture role. */
export type ImportLocation = { path: string; role: ImportDirectionRole };

export type ImportDirectionMessages = 'typesToRuntime' | 'runtimeToTests' | 'testsToInternals' | 'configToRuntime';

export type ImportEdge = {
    role: ImportDirectionRole;
    targetRole: ImportDirectionRole;
    source: string;
    target: string;
    isTypeOnly: boolean;
};

export type ImportNode = TSESTree.ImportDeclaration | TSESTree.ExportAllDeclaration | TSESTree.ExportNamedDeclaration;

export type ImportVerdict = { messageId: ImportDirectionMessages; data: Record<string, string> };

export type ImportDirectionOptions = [
    { roles?: ImportDirectionRoles; aliases?: Record<string, string>; scope?: string },
];

export type MaxBarrelReexportsOptions = [{ max?: number }];

export type TrivialFunctionsOptions = [{ maxStatements?: number }];

export type TrivialFilesOptions = [{ maxStatements?: number; allowIndex?: boolean }];

export type ContentCheck = (node: TSESTree.Node | null) => boolean;

export type EnvOwnerOptions = [{ owners?: string[]; allowed?: string[] }];

export type CrossFolderImportsOptions = [{ aliases?: Record<string, string> }];

export type ReexportsOptions = [{ allowIndex?: boolean }];

export type ImportSource = ImportNode | TSESTree.ImportExpression;
