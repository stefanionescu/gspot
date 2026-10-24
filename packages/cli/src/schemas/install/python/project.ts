import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { ToolPyproject } from '#cli/types/install/tool-projects.ts';

const uvSchema = z.object({ package: z.literal(false) } satisfies SchemaShape<ToolPyproject['tool']['uv']>);

export const toolPyprojectSchema = z.object({
    project: z.object({
        name: z.string(),
        version: z.string(),
        'requires-python': z.string(),
        dependencies: z.string().array(),
    } satisfies SchemaShape<ToolPyproject['project']>),
    tool: z.object({
        uv: uvSchema,
    } satisfies SchemaShape<ToolPyproject['tool']>),
}) satisfies z.ZodType<ToolPyproject>;
