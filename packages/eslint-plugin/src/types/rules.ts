// The types of rules in this package.
import type { TSESTree } from '@typescript-eslint/utils';

export type ContentCheck = (node: TSESTree.Node) => boolean;

export type ImportStyleName = 'js' | 'ts' | 'extensionless';
export type ImportStyleOptions = [{ style: ImportStyleName; internalPrefixes?: string[] }];
export type LayoutOptions = [{ allowRequire?: boolean }];
export type EnvOwnerOptions = [{ owners?: string[] }];
export type TypesPlacementMessages =
    | 'interface'
    | 'aliasOutside'
    | 'enumOutside'
    | 'runtimeInside'
    | 'defaultInside'
    | 'valueImport';
export type TypesPlacementReporter = (
    node: TSESTree.Node,
    messageId: TypesPlacementMessages,
    extra?: Record<string, string>,
) => void;
export type TypesPlacementOptions = [{ directory?: string; allowInterface?: boolean; allowed?: string[] }];
export type CrossScopeImportsOptions = [{ scopes?: string[]; allowedEscapes?: string[] }];
export type TestFoldersOptions = [{ pattern?: string; directories?: string[]; harness?: string; allowed?: string[] }];

export type ImportDirectionRoles = {
    types?: string[];
    tests?: string[];
    harness?: string[];
    config?: string[];
    env?: string[];
    runtime?: string[];
};
export type ImportDirectionRole = 'types' | 'tests' | 'harness' | 'config' | 'env' | 'runtime' | 'other';
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
    { roles?: ImportDirectionRoles; aliases?: Record<string, string>; contracts?: string[]; scope?: string },
];

export type MaxBarrelReexportsOptions = [{ max?: number }];
export type TrivialFunctionsOptions = [{ maxStatements?: number }];
export type RegistryInstancesOptions = [{ files?: string[] }];
export type ClientEnvOptions = [{ isClient?: boolean; publicPrefixes?: string[]; allowed?: string[] }];
export type IndexImportsOptions = [{ allowed?: string[]; patterns?: string[] }];
export type CrossFolderImportsOptions = [{ roots?: string[]; aliases?: Record<string, string> }];
export type ReexportsOptions = [{ allowIndex?: boolean }];
