// The types of rules in this package.
import type { TSESTree } from '@typescript-eslint/utils';

export type HarnessBarrelImportsOptions = [{ barrels?: string[]; within?: string[] }];
export type ImportPathStyleName = 'js' | 'ts' | 'extensionless';
export type ImportPathStyleOptions = [{ style: ImportPathStyleName; internalPrefixes?: string[] }];
export type HeaderCommentsOptions = [{ allowRequire?: boolean }];
export type EnvAccessOwnerOptions = [{ owners?: string[] }];
export type TypesPlacementMessages =
    | 'interface'
    | 'aliasOutside'
    | 'enumOutside'
    | 'runtimeInside'
    | 'defaultInside'
    | 'valueImportInside';
export type TypesPlacementReporter = (
    node: TSESTree.Node,
    messageId: TypesPlacementMessages,
    extra?: Record<string, string>,
) => void;
export type TypesPlacementOptions = [{ typesDirectory?: string; allowInterface?: boolean; exempt?: string[] }];
export type SingleFileFoldersOptions = [{ extensions?: string[]; ignorePaths?: string[]; allow?: string[] }];
export type CrossProjectImportsOptions = [{ scopes?: string[]; allowedEscapes?: string[] }];
export type TestsDirectoryContentsOptions = [
    { testPattern?: string; testDirectories?: string[]; harnessDirectory?: string; excluded?: string[] },
];
export type ImportLayoutEntry = {
    node: TSESTree.Statement;
    start: number;
    end: number;
    text: string;
    sortText: string;
    lineSpan: number;
    multiLine: boolean;
    index: number;
};
export type ImportLayoutOptions = [{ allowRequire?: boolean }];
export type ImportDirectionRoles = {
    types?: string[];
    tests?: string[];
    harness?: string[];
    config?: string[];
    env?: string[];
    runtime?: string[];
};
export type ImportDirectionRole = 'types' | 'tests' | 'harness' | 'config' | 'env' | 'runtime' | 'other';
export type ImportDirectionMessages = 'typesOnlyTypes' | 'runtimeToTests' | 'testsToInternals' | 'configToRuntime';
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
export type NoTrivialFunctionsOptions = [{ maxStatements?: number }];
export type RegistryInstanceOnlyOptions = [{ registryFiles?: string[] }];
export type NoClientEnvironmentOptions = [{ clientModule?: boolean; publicPrefixes?: string[]; allowed?: string[] }];
export type NoPrefixCollisionsOptions = [
    { threshold?: number; scope?: string[]; ignorePaths?: string[]; allow?: string[] },
];
export type NoIndexImportsOptions = [{ allow?: string[]; patterns?: string[] }];
export type CrossFolderImportsOptions = [{ scope?: string[]; aliases?: Record<string, string> }];
export type NoReexportsOptions = [{ allowIndex?: boolean }];
