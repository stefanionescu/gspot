import type { z } from 'zod';
import type { ToolProjectLockfileName } from '#cli/types/parsers/lockfiles.ts';

import type {
    poetryToolSchema,
    toolProjectSchema,
    pythonManifestSchema,
    packageManifestSchema,
    packageInstallerSchema,
    packageInstallerIdentitySchema,
    packageInstallerDeclarationSchema,
} from '#cli/parsers/schema/packages.ts';

export type PackageInstaller = z.infer<typeof packageInstallerSchema>;

/** A selected package manager whose undeclared version is inspected when a tool project needs it. */
export type PackageInstallerIdentity = z.infer<typeof packageInstallerIdentitySchema>;
/** A validated manager name with the exact version or range as authored. */
export type PackageInstallerDeclaration = z.infer<typeof packageInstallerDeclarationSchema>;

export type PackageManifest = z.infer<typeof packageManifestSchema>;

export type DependencyMap = Record<string, string>;

/** Dependencies and runtime evidence from one supported project manifest. */
export type ProjectManifest = {
    path: string;
    kind: 'package.json' | 'pyproject.toml' | 'Package.swift' | 'Pipfile' | 'requirements.txt';
    dependencies: DependencyMap;
    installed: DependencyMap;
    runtimes?: Record<string, string>;
};

/** Pure parser selected by a supported repository manifest name. */
export type ManifestParser = (text: string) => ProjectManifest;

export type PythonManifest = z.infer<typeof pythonManifestSchema>;

export type PoetrySettings = z.infer<typeof poetryToolSchema> | undefined;

/** Validated npm tool project with the manager and lockfile it declares. */
export type PackageToolProject = {
    installer: PackageInstaller;
    dependencies: z.infer<typeof toolProjectSchema>['devDependencies'];
    lockfile: ToolProjectLockfileName;
    lockfilePath: string;
};
