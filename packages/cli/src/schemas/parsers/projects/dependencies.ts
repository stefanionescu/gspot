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
