import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { stringMap, stringList } from '#cli/schemas/parsers/projects/dependencies/strings.ts';

import type {
    Pipfile,
    Pyproject,
    PoetryGroup,
    PythonProject,
    PoetrySettings,
    PythonDependency,
    PythonGroupInclude,
    PythonToolSettings,
    PythonDependencyGroup,
} from '#cli/types/parsers/projects/dependencies.ts';

const dependencyGroups = z.record(z.string(), stringList) satisfies z.ZodType<Record<string, string[]>>;

const groupInclude = z.object({
    'include-group': z.string(),
} satisfies SchemaShape<PythonGroupInclude>);

const dependencyGroup = z.array(z.union([z.string(), groupInclude])) satisfies z.ZodType<PythonDependencyGroup>;

const projectTable = z.object({
    dependencies: stringList.optional(),
    'optional-dependencies': dependencyGroups.optional(),
    scripts: stringMap.optional(),
    'requires-python': z.string().optional(),
} satisfies SchemaShape<PythonProject>);

const pythonDependencyDetail = z.record(z.string(), z.unknown()) satisfies z.ZodType<Record<string, unknown>>;

const pythonDependencyMap = z.record(
    z.string(),
    z.union([
        z.string(),
        pythonDependencyDetail,
        z.array(pythonDependencyDetail),
    ]) satisfies z.ZodType<PythonDependency>,
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
