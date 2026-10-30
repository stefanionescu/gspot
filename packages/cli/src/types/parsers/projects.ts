import type { z } from 'zod';
import type ts from 'typescript';
import type { PYTHON_LOCKFILES, JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects.ts';

import type {
    pipfileSchema,
    pbxprojSchema,
    tsconfigSchema,
    pyprojectSchema,
    uvLockfileSchema,
    packageJsonSchema,
} from '#cli/schemas/parsers/projects.ts';

export type PackageJson = z.infer<typeof packageJsonSchema>;

export type Dependencies = Record<string, string>;

export type DependencyFile = {
    path: string;
    kind: 'package.json' | 'pyproject.toml' | 'Package.swift' | 'Pipfile' | 'requirements.txt';
    dependencies: Dependencies;
    installed: Dependencies;
    runtimes?: Record<string, string>;
};

export type DependencyFileParser = (path: string, text: string) => DependencyFile | Promise<DependencyFile>;

export type PythonDependency = NonNullable<z.infer<typeof pipfileSchema>['packages']>[string];

export type Pyproject = z.infer<typeof pyprojectSchema>;

export type LockfileName = (typeof JAVASCRIPT_LOCKFILES)[number];

export type LockedPackageLockfile = LockfileName | (typeof PYTHON_LOCKFILES)[number];

export type UvLockfile = z.infer<typeof uvLockfileSchema>;

export type ParsedTsconfig = Omit<ts.ParsedCommandLine, 'raw'> & {
    raw: z.infer<typeof tsconfigSchema>;
    tsconfigFiles: string[];
    extendedTsconfigFiles: string[];
};

export type TypeScriptProject = {
    path: string;
    config: ParsedTsconfig;
    projects: Map<string, ParsedTsconfig>;
};

export type PbxElement = z.infer<typeof pbxprojSchema>['objects'][string];

export type ParsedPbxproj = { objects: Record<string, PbxElement>; root: PbxElement };

export type XcodeProject = {
    objects: Record<string, PbxElement>;
    root: PbxElement & { mainGroup: string };
    folder: string;
    parents: Map<string, string>;
    visiting: Set<string>;
};

export type TargetFolder = { path: string; excluded: Set<string> };

export type ProjectSources = {
    sources: Set<string>;
    folders: TargetFolder[];
    targets: { name: string; sources: string[]; folders: TargetFolder[] }[];
};

export type ProjectBuildSettings = { sdkRoot: string | undefined; swiftVersion: string | undefined };

export type ProjectTokens = { tokens: string[]; index: number };
