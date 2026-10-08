import { z } from 'zod';
import semver from 'semver';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import type { ToolProjectLockfileName } from '#cli/types/parsers/lockfiles.ts';

import {
    NPM_TOOL_PROJECT,
    YARN_BERRY_MAJOR,
    NEXT_ESLINT_PLUGIN,
    NEXT_ESLINT_PLUGIN_MAJOR,
} from '#cli/config/parsers/packages.ts';
import type {
    PackageJson,
    PackageInstaller,
    PackageToolProject,
    PackageInstallerDeclaration,
} from '#cli/types/parsers/packages.ts';

const stringList = z.array(z.string());

const stringMap = z.record(z.string(), z.string());

const dependencyGroups = z.record(z.string(), stringList);

const groupInclude = z.object({ 'include-group': z.string() });

const dependencyGroup = z.array(z.union([z.string(), groupInclude]));

const pythonProject = z.object({
    dependencies: stringList.optional(),
    'optional-dependencies': dependencyGroups.optional(),
    scripts: stringMap.optional(),
    'requires-python': z.string().optional(),
});

const pythonDependencyDetail = z.record(z.string(), z.unknown());

const pythonDependencyMap = z.record(
    z.string(),
    z.union([z.string(), pythonDependencyDetail, z.array(pythonDependencyDetail)]),
);

const poetryGroup = z.object({ dependencies: pythonDependencyMap.optional() });

const workspacePackages = z.object({ packages: stringList });

const devEngineInstaller = z.object({ name: z.string().optional(), version: z.string().optional() });

const devEngines = z.object({
    packageManager: z.union([devEngineInstaller, z.array(devEngineInstaller)]).optional(),
});

const installerVersion = z
    .string()
    .refine(
        (value) =>
            semver.valid(value) !== null || (/^(?:0|[1-9]\d*)\.x$/u.test(value) && semver.validRange(value) !== null),
        'Package manager version must be exact or a major requirement.',
    );

const toolDependencyVersion = z.string().refine((value) => semver.valid(value) !== null);

function packageInstallerDeclaration(value: string): PackageInstallerDeclaration {
    const [name, declared, ...verbatim] = value.split('@');
    if (verbatim.length > 0) throw new Error('Invalid packageManager declaration.');
    const version = (declared ?? '').split('+sha', 1)[0];
    return packageInstallerDeclarationSchema.parse({ name, version });
}

export const poetryToolSchema = z.object({
    dependencies: pythonDependencyMap.optional(),
    group: z.record(z.string(), poetryGroup).optional(),
});

export const packageInstallerIdentitySchema = z.strictObject({
    name: z.enum(['npm', 'bun', 'pnpm', 'yarn']),
    version: installerVersion.optional(),
});

export const packageInstallerSchema = packageInstallerIdentitySchema.required();

/** Authored manager names before installation validates their requested version. */
export const packageInstallerDeclarationSchema = packageInstallerIdentitySchema.extend({
    version: z.string().optional(),
});

export const toolProjectSchema = z.strictObject({
    name: z.literal(NPM_TOOL_PROJECT.name),
    private: z.literal(NPM_TOOL_PROJECT.private),
    type: z.literal(NPM_TOOL_PROJECT.type),
    packageManager: z.string(),
    devDependencies: z
        .object({
            [NEXT_ESLINT_PLUGIN]: toolDependencyVersion.or(z.string().regex(NEXT_ESLINT_PLUGIN_MAJOR)).optional(),
        })
        .catchall(toolDependencyVersion),
});

export const pipfileSchema = z.object({
    packages: pythonDependencyMap.optional(),
    'dev-packages': pythonDependencyMap.optional(),
});

export const pythonManifestSchema = z.object({
    project: pythonProject.optional(),
    'dependency-groups': z.record(z.string(), dependencyGroup).optional(),
    tool: z.object({ pytest: z.unknown().optional(), poetry: poetryToolSchema.optional() }).optional(),
});

export const packageManifestSchema = z.looseObject({
    name: z.string().optional(),
    version: z.string().optional(),
    imports: z.record(z.string(), z.unknown()).optional(),
    private: z.boolean().optional(),
    packageManager: z.string().optional(),
    devEngines: devEngines.optional(),
    type: z.string().optional(),
    workspaces: z.union([stringList, workspacePackages]).optional(),
    dependencies: stringMap.optional(),
    devDependencies: stringMap.optional(),
    peerDependencies: stringMap.optional(),
    optionalDependencies: stringMap.optional(),
    scripts: stringMap.optional(),
    engines: stringMap.optional(),
});

/** Native Bun installation options read by dependency policy checks. */
export const bunInstallSchema = z.object({ install: z.record(z.string(), z.unknown()).default({}) });

/**
 * Identify the Yarn major version that uses Berry configuration and installation arguments.
 * @param installer the validated package manager and version requirement
 * @returns whether the manager is Yarn Berry
 */
export function isYarnBerry(installer: PackageInstaller): boolean {
    if (installer.name !== 'yarn') return false;
    return getPackageInstallerMajor(installer) >= YARN_BERRY_MAJOR;
}

/**
 * Get the major version from a validated package-manager version or major requirement.
 * @param installer the validated package manager
 * @returns the required major version
 */
export function getPackageInstallerMajor(installer: PackageInstaller): number {
    return semver.major(installer.version.replace('.x', '.0.0'));
}

/**
 * Validate a package-manager version requirement at the manifest boundary.
 * @param value the packageManager declaration
 * @returns the manager name and version requirement
 */
export function parsePackageInstaller(value: string): PackageInstaller {
    return packageInstallerSchema.parse(packageInstallerDeclaration(value));
}

/**
 * Read an authored manager declaration before validating its installation version.
 * @param manifest the validated package manifest
 * @returns packageManager first, then the first devEngines declaration, or no declaration
 */
export function declaredPackageInstaller(manifest: PackageJson): PackageInstallerDeclaration | undefined {
    if (manifest.packageManager !== undefined) return packageInstallerDeclaration(manifest.packageManager);
    const engines = manifest.devEngines?.packageManager;
    const entry = Array.isArray(engines) ? engines[0] : engines;
    return entry?.name === undefined ? undefined : packageInstallerDeclarationSchema.parse(entry);
}

/**
 * Validate an npm tool project and identify its package manager and lockfile.
 * @param text the generated or recorded package.json contents
 * @returns the declared manager, dependencies, and repository-relative lockfile path
 */
export function parseToolProject(text: string): PackageToolProject {
    const parsed = toolProjectSchema.parse(JSON.parse(text));
    const installer = parsePackageInstaller(parsed.packageManager);
    const lockfile = packageLockfile(installer.name);
    return { installer, dependencies: parsed.devDependencies, lockfile, lockfilePath: `${DOT_GSPOT}/${lockfile}` };
}

/**
 * Select the native lockfile of a npm tool project's manager.
 * @param installer the validated package manager
 * @returns the lockfile basename declared by its registry entry
 */
export function packageLockfile(installer: PackageInstaller['name']): ToolProjectLockfileName {
    for (const entry of LOCKFILES) if ('toolProject' in entry && entry.client === installer) return entry.file;
    throw new Error(`The lockfile registry declares no tool project lockfile for ${installer}.`);
}
