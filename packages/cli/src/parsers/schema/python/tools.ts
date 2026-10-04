import { z } from 'zod';
import { PYTHON_TOOL_PROJECT } from '#cli/config/parsers/packages.ts';

const requirementSchema = z.object({ name: z.string(), specifier: z.string() });
export const pyprojectSchema = z.strictObject({
    project: z.strictObject({
        name: z.literal(PYTHON_TOOL_PROJECT.name),
        version: z.literal(PYTHON_TOOL_PROJECT.version),
        'requires-python': z.literal(PYTHON_TOOL_PROJECT['requires-python']),
        dependencies: z.array(z.string().regex(/^[a-z0-9._-]+==[a-z0-9.+!_-]+$/iu)),
    }),
    tool: z.strictObject({
        uv: z.strictObject({ package: z.literal(false), 'constraint-dependencies': z.array(z.string()).default([]) }),
    }),
});

export const lockSchema = z.object({
    version: z.literal(1),
    'requires-python': z.string(),
    manifest: z.object({ constraints: z.array(requirementSchema).default([]) }).default({ constraints: [] }),
    package: z.array(
        z.object({
            name: z.string(),
            version: z.string(),
            source: z.looseObject({ virtual: z.string().optional() }),
            metadata: z
                .object({ 'requires-dist': z.array(requirementSchema).default([]) })
                .default({ 'requires-dist': [] }),
        }),
    ),
});

export const uvProjectSettingsSchema = z.object({
    tool: z.object({ uv: z.record(z.string(), z.unknown()).default({}) }).default({ uv: {} }),
});

export const uvFindLinksSchema = z.array(z.string());
export const uvIndexSchema = z.looseObject({ url: z.string() });
export const uvIndexesSchema = z.array(uvIndexSchema);
