// The option shapes of the rules, one per rule that takes options.
import type { ImportDirectionRoles, ImportPathStyleName } from '#plugin-types/plugin.ts';

export type ImportPathStyleOptions = [{ style: ImportPathStyleName; internalPrefixes?: string[] }];

export type NoCallThroughOptions = [{ allow?: string[] }];

export type HeaderCommentsOptions = [{ allowRequire?: boolean }];

export type EnvAccessOwnerOptions = [{ owners?: string[] }];

export type TypesPlacementOptions = [{ typesDirectory?: string; allowInterface?: boolean; exempt?: string[] }];

export type CrossProjectImportsOptions = [{ scopes?: string[]; allowedEscapes?: string[] }];

export type HarnessBarrelImportsOptions = [{ barrels?: string[]; within?: string[] }];

export type ImportLayoutOptions = [{ allowRequire?: boolean }];

export type ImportDirectionOptions = [
    { roles?: ImportDirectionRoles; aliases?: Record<string, string>; contracts?: string[]; scope?: string },
];

export type MaxBarrelReexportsOptions = [{ max?: number }];

export type NoTrivialFilesOptions = [{ entryFiles?: string[] }];

export type TestsDirectoryContentsOptions = [
    { testPattern?: string; testDirectories?: string[]; harnessDirectory?: string; excluded?: string[] },
];

export type RegistryInstanceOnlyOptions = [{ registryFiles?: string[] }];

export type NoClientEnvironmentOptions = [{ clientModule?: boolean; publicPrefixes?: string[]; allowed?: string[] }];

export type NoIndexImportsOptions = [{ allow?: string[]; patterns?: string[] }];

export type CrossFolderImportsOptions = [{ scope?: string[]; aliases?: Record<string, string> }];

export type NoReexportsOptions = [{ allowIndex?: boolean }];

/** A rule context with any message ids and options; what the shared file helpers accept. */

export type NoTrivialFunctionsOptions = [{ maxStatements?: number }];

export type SingleFileFoldersOptions = [{ extensions?: string[]; ignorePaths?: string[]; allow?: string[] }];

export type NoPrefixCollisionsOptions = [
    { threshold?: number; scope?: string[]; ignorePaths?: string[]; allow?: string[] },
];
