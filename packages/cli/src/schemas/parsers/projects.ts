import { z } from 'zod';

const stringsSchema = z.string().array();

const stringRecordSchema = z.record(z.string(), z.string());

const workspacePackagesSchema = z.object({
    packages: stringsSchema,
});

const devEngineSchema = z.object({
    name: z.string().optional(),
    version: z.string().optional(),
});

const devEnginesSchema = z.object({
    packageManager: z.union([devEngineSchema, devEngineSchema.array()]).optional(),
});

export const packageJsonSchema = z.looseObject({
    name: z.string().optional(),
    version: z.string().optional(),
    imports: z.record(z.string(), z.unknown()).optional(),
    files: stringsSchema.optional(),
    packageManager: z.string().optional(),
    devEngines: devEnginesSchema.optional(),
    workspaces: z.union([stringsSchema, workspacePackagesSchema]).optional(),
    dependencies: stringRecordSchema.optional(),
    devDependencies: stringRecordSchema.optional(),
    peerDependencies: stringRecordSchema.optional(),
    optionalDependencies: stringRecordSchema.optional(),
    scripts: stringRecordSchema.optional(),
    engines: stringRecordSchema.optional(),
});

const dependencyGroupsSchema = z.record(z.string(), stringsSchema);

const groupIncludeSchema = z.object({
    'include-group': z.string(),
});

const dependencyGroupSchema = z.union([z.string(), groupIncludeSchema]).array();

const projectTableSchema = z.object({
    dependencies: stringsSchema.optional(),
    'optional-dependencies': dependencyGroupsSchema.optional(),
});

const pythonDependencyDetailSchema = z.record(z.string(), z.unknown());

const pythonDependenciesSchema = z.record(
    z.string(),
    z.union([z.string(), pythonDependencyDetailSchema, pythonDependencyDetailSchema.array()]),
);

const poetryGroupSchema = z.object({
    dependencies: pythonDependenciesSchema.optional(),
});

const poetryToolSchema = z.object({
    dependencies: pythonDependenciesSchema.optional(),
    group: z.record(z.string(), poetryGroupSchema).optional(),
});

const toolSettingsSchema = z.object({
    pytest: z.unknown().optional(),
    poetry: poetryToolSchema.optional(),
});

export const pipfileSchema = z.object({
    packages: pythonDependenciesSchema.optional(),
    'dev-packages': pythonDependenciesSchema.optional(),
});

export const pyprojectSchema = z.object({
    project: projectTableSchema.optional(),
    'dependency-groups': z.record(z.string(), dependencyGroupSchema).optional(),
    tool: toolSettingsSchema.optional(),
});

export const dependencySectionsSchema = z.looseObject({
    peerDependencies: z.record(z.string(), z.unknown()).optional(),
    dependencies: z.record(z.string(), z.unknown()).optional(),
    devDependencies: z.record(z.string(), z.unknown()).optional(),
    optionalDependencies: z.record(z.string(), z.unknown()).optional(),
});

const npmPackageSchema = z.looseObject({
    version: z.string().optional(),
});

export const npmLockfileSchema = z.looseObject({
    packages: z.record(z.string(), npmPackageSchema).default({}),
});

export const bunLockfileSchema = z.looseObject({
    workspaces: z.record(z.string(), z.unknown()).default({}),
    packages: z.record(z.string(), z.unknown().array()).default({}),
});

export const pnpmLockfileSchema = z.looseObject({
    importers: z.record(z.string(), z.unknown()).default({}),
    packages: z.record(z.string(), z.unknown()).default({}),
});

export const yarnLockfileSchema = z.record(z.string(), z.unknown());

export const yarnPackageSchema = z.looseObject({
    version: z.string().optional(),
    resolved: z.string().optional(),
});

const uvSourceSchema = z.looseObject({
    virtual: z.string().optional(),
});

const uvRequirementSchema = z.object({
    name: z.string(),
    specifier: z.string().optional(),
});

const uvMetadataSchema = z.looseObject({
    'requires-dist': uvRequirementSchema.array().optional(),
});

export const uvLockfileSchema = z.looseObject({
    options: z.object({ 'exclude-newer-span': z.string().optional() }).optional(),
    version: z.number().optional(),
    'requires-python': z.string().optional(),
    package: z
        .looseObject({
            name: z.string(),
            version: z.string().optional(),
            source: uvSourceSchema.optional(),
            metadata: uvMetadataSchema.optional(),
        })
        .array()
        .default([]),
});

const taskSchema = z.looseObject({
    alias: z.union([z.string(), z.string().array()]).optional(),
});
const taskValueSchema = z.union([z.string(), z.string().array(), taskSchema]);

export const miseTasksSchema = z.object({
    tasks: z.record(z.string(), taskValueSchema).default({}),
});

export const tsconfigSchema = z.looseObject({
    compilerOptions: z.record(z.string(), z.unknown()).optional(),
});

const buildSettingsSchema = z.object({
    SDKROOT: z.string().optional(),
    SWIFT_VERSION: z.string().optional(),
});

const pbxRecordSchema = z.object({
    isa: z.string(),
    buildSettings: buildSettingsSchema.optional(),
    name: z.string().optional(),
    path: z.string().optional(),
    sourceTree: z.string().optional(),
    children: z.string().array().optional(),
    fileRef: z.string().optional(),
    files: z.string().array().optional(),
    buildPhases: z.string().array().optional(),
    fileSystemSynchronizedGroups: z.string().array().optional(),
    exceptions: z.string().array().optional(),
    membershipExceptions: z.string().array().optional(),
    target: z.string().optional(),
    mainGroup: z.string().optional(),
    targets: z.string().array().optional(),
    projectDirPath: z.string().optional(),
});

export const pbxprojSchema = z.object({
    rootObject: z.string(),
    objects: z.record(z.string(), pbxRecordSchema),
});
