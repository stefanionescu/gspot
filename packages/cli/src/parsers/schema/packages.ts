import { z } from 'zod';
import semver from 'semver';
import { NPM_TOOL_PROJECT } from '#cli/config/parsers/packages.ts';

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
const exactVersion = z
    .string()
    .refine((value) => semver.valid(value) !== null, 'Package manager version must be exact.');

export const poetryToolSchema = z.object({
    dependencies: pythonDependencyMap.optional(),
    group: z.record(z.string(), poetryGroup).optional(),
});

export const packageInstallerIdentitySchema = z.strictObject({
    name: z.enum(['npm', 'bun', 'pnpm', 'yarn']),
    version: exactVersion.optional(),
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
    devDependencies: z.record(
        z.string(),
        z.string().refine((value) => semver.valid(value) !== null),
    ),
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
