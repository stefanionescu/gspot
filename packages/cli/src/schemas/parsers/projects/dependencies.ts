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

const stringList = z.string().array() satisfies z.ZodType<string[]>;

const stringMap = z.record(z.string(), z.string()) satisfies z.ZodType<Record<string, string>>;

const workspacePackages = z.object({
    packages: stringList,
} satisfies SchemaShape<PackageWorkspaces>);

const devEngineSchema = z.object({
    name: z.string().optional(),
    version: z.string().optional(),
} satisfies SchemaShape<PackageManagerEngine>);

const devEngines = z.object({
    packageManager: z.union([devEngineSchema, devEngineSchema.array()]).optional(),
} satisfies SchemaShape<PackageDevEngines>);

export const packageJsonSchema = z.looseObject({
    name: z.string().optional(),
    version: z.string().optional(),
    imports: z.record(z.string(), z.unknown()).optional(),
    files: stringList.optional(),
    packageManager: z.string().optional(),
    devEngines: devEngines.optional(),
    workspaces: z.union([stringList, workspacePackages]).optional(),
    dependencies: stringMap.optional(),
    devDependencies: stringMap.optional(),
    peerDependencies: stringMap.optional(),
    optionalDependencies: stringMap.optional(),
    scripts: stringMap.optional(),
    engines: stringMap.optional(),
} satisfies SchemaShape<PackageJsonFields>);

const dependencyGroups = z.record(z.string(), stringList) satisfies z.ZodType<Record<string, string[]>>;

const groupInclude = z.object({
    'include-group': z.string(),
} satisfies SchemaShape<PythonGroupInclude>);

const dependencyGroup = z.union([z.string(), groupInclude]).array() satisfies z.ZodType<PythonDependencyGroup>;

const projectTable = z.object({
    dependencies: stringList.optional(),
    'optional-dependencies': dependencyGroups.optional(),
} satisfies SchemaShape<PythonProject>);

const pythonDependencyDetail = z.record(z.string(), z.unknown()) satisfies z.ZodType<Record<string, unknown>>;

const pythonDependencyMap = z.record(
    z.string(),
    z.union([z.string(), pythonDependencyDetail, pythonDependencyDetail.array()]) satisfies z.ZodType<PythonDependency>,
) satisfies z.ZodType<Record<string, PythonDependency>>;

const poetryGroup = z.object({
    dependencies: pythonDependencyMap.optional(),
} satisfies SchemaShape<PoetryGroup>);

const poetryToolSchema = z.object({
    dependencies: pythonDependencyMap.optional(),
    group: z.record(z.string(), poetryGroup).optional(),
} satisfies SchemaShape<PoetrySettings>);

const toolSettings = z.object({
    pytest: z.unknown().optional(),
    poetry: poetryToolSchema.optional(),
} satisfies SchemaShape<PythonToolSettings>);

export const pipfileSchema = z.object({
    packages: pythonDependencyMap.optional(),
    'dev-packages': pythonDependencyMap.optional(),
} satisfies SchemaShape<Pipfile>);

export const pyprojectSchema = z.object({
    project: projectTable.optional(),
    'dependency-groups': z.record(z.string(), dependencyGroup).optional(),
    tool: toolSettings.optional(),
} satisfies SchemaShape<Pyproject>);
