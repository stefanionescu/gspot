import type { z } from 'zod';
import type ts from 'typescript';
import type { typeScriptConfigSchema } from '#cli/parsers/schema/public.ts';
import type { ToolProjectLockfileName } from '#cli/types/parsers/lockfiles.ts';

import type {
    poetryToolSchema,
    toolProjectSchema,
    pythonManifestSchema,
    packageManifestSchema,
    packageInstallerSchema,
    packageInstallerIdentitySchema,
    packageInstallerDeclarationSchema,
} from '#cli/parsers/packages/contracts.ts';

export type PackageInstaller = z.infer<typeof packageInstallerSchema>;

/** A selected package manager whose undeclared version is inspected when a tool project needs it. */
export type PackageInstallerIdentity = z.infer<typeof packageInstallerIdentitySchema>;
/** A validated manager name with the exact version or range as authored. */
export type PackageInstallerDeclaration = z.infer<typeof packageInstallerDeclarationSchema>;

export type PackageJson = z.infer<typeof packageManifestSchema>;

/** An installed dependency resolved from an actual project manifest. */
export type InstalledDependency = { path: string; version: string | undefined };

export type DependencyMap = Record<string, string>;

/** Dependencies and runtime evidence from one supported project manifest. */
export type PackageManifest = {
    path: string;
    kind: 'package.json' | 'pyproject.toml' | 'Package.swift' | 'Pipfile' | 'requirements.txt';
    dependencies: DependencyMap;
    installed: DependencyMap;
    runtimes?: Record<string, string>;
};

/** Pure parser selected by a supported repository manifest name. */
export type ManifestParser = (path: string, text: string) => PackageManifest;

export type PythonManifest = z.infer<typeof pythonManifestSchema>;

export type PoetrySettings = z.infer<typeof poetryToolSchema> | undefined;

/** Validated npm tool project with the manager and lockfile it declares. */
export type PackageToolProject = {
    installer: PackageInstaller;
    dependencies: z.infer<typeof toolProjectSchema>['devDependencies'];
    lockfile: ToolProjectLockfileName;
    lockfilePath: string;
};

/** Native compiler configuration with its validated authored fields and actual configuration reads. */
export type TypeScriptConfiguration = Omit<ts.ParsedCommandLine, 'raw'> & {
    raw: z.infer<typeof typeScriptConfigSchema>;
    configurationFiles: string[];
};

/** The nearest authored project and its native reference graph. */
export type TypeScriptProject = {
    path: string;
    config: TypeScriptConfiguration;
    projects: Map<string, TypeScriptConfiguration>;
};
