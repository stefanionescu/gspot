import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';

import type {
    Pipfile,
    Pyproject,
    PoetryGroup,
    PythonProject,
    PoetrySettings,
    PythonDependency,
    PackageJsonFields,
    PackageDevEngines,
    PackageWorkspaces,
    PythonGroupInclude,
    PythonToolSettings,
    PackageManagerEngine,
    PythonDependencyGroup,
} from '#cli/types/parsers/projects/dependencies.ts';

const stringsSchema = z.string().array() satisfies z.ZodType<string[]>;

const stringRecordSchema = z.record(z.string(), z.string()) satisfies z.ZodType<Record<string, string>>;

const workspacePackagesSchema = z.object({
    packages: stringsSchema,
} satisfies SchemaShape<PackageWorkspaces>);

const devEngineSchema = z.object({
    name: z.string().optional(),
    version: z.string().optional(),
} satisfies SchemaShape<PackageManagerEngine>);

const devEnginesSchema = z.object({
    packageManager: z.union([devEngineSchema, devEngineSchema.array()]).optional(),
} satisfies SchemaShape<PackageDevEngines>);

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
} satisfies SchemaShape<PackageJsonFields>);

const dependencyGroupsSchema = z.record(z.string(), stringsSchema) satisfies z.ZodType<Record<string, string[]>>;

const groupIncludeSchema = z.object({
    'include-group': z.string(),
} satisfies SchemaShape<PythonGroupInclude>);

const dependencyGroupSchema = z
    .union([z.string(), groupIncludeSchema])
    .array() satisfies z.ZodType<PythonDependencyGroup>;

const projectTableSchema = z.object({
    dependencies: stringsSchema.optional(),
    'optional-dependencies': dependencyGroupsSchema.optional(),
} satisfies SchemaShape<PythonProject>);

const pythonDependencyDetailSchema = z.record(z.string(), z.unknown()) satisfies z.ZodType<Record<string, unknown>>;

const pythonDependenciesSchema = z.record(
    z.string(),
    z.union([
        z.string(),
        pythonDependencyDetailSchema,
        pythonDependencyDetailSchema.array(),
    ]) satisfies z.ZodType<PythonDependency>,
) satisfies z.ZodType<Record<string, PythonDependency>>;

const poetryGroupSchema = z.object({
    dependencies: pythonDependenciesSchema.optional(),
} satisfies SchemaShape<PoetryGroup>);

const poetryToolSchema = z.object({
    dependencies: pythonDependenciesSchema.optional(),
    group: z.record(z.string(), poetryGroupSchema).optional(),
} satisfies SchemaShape<PoetrySettings>);

const toolSettingsSchema = z.object({
    pytest: z.unknown().optional(),
    poetry: poetryToolSchema.optional(),
} satisfies SchemaShape<PythonToolSettings>);

export const pipfileSchema = z.object({
    packages: pythonDependenciesSchema.optional(),
    'dev-packages': pythonDependenciesSchema.optional(),
} satisfies SchemaShape<Pipfile>);

export const pyprojectSchema = z.object({
    project: projectTableSchema.optional(),
    'dependency-groups': z.record(z.string(), dependencyGroupSchema).optional(),
    tool: toolSettingsSchema.optional(),
} satisfies SchemaShape<Pyproject>);
