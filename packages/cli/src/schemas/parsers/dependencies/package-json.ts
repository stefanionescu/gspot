import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { stringMap, stringList } from '#cli/schemas/parsers/dependencies/strings.ts';

import type {
    PackageJson,
    PackageJsonFields,
    PackageDevEngines,
    PackageWorkspaces,
    PackageManagerEngine,
} from '#cli/types/parsers/dependencies.ts';

const workspacePackages = z.object({
    packages: stringList,
} satisfies SchemaShape<PackageWorkspaces>);

const devEngineEntry = z.object({
    name: z.string().optional(),
    version: z.string().optional(),
} satisfies SchemaShape<PackageManagerEngine>);

const devEngines = z.object({
    packageManager: z.union([devEngineEntry, z.array(devEngineEntry)]).optional(),
} satisfies SchemaShape<PackageDevEngines>);

export const packageJsonSchema = z.looseObject({
    name: z.string().optional(),
    version: z.string().optional(),
    imports: z.record(z.string(), z.unknown()).optional(),
    files: stringList.optional(),
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
} satisfies SchemaShape<PackageJsonFields>) satisfies z.ZodType<PackageJson>;
