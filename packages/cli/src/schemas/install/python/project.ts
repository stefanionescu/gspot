import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { ToolPyproject } from '#cli/types/install/tool-projects.ts';

export const toolPyprojectSchema = z.object({
    project: z.object({
        name: z.string(),
        version: z.string(),
        'requires-python': z.string(),
        dependencies: z.array(z.string()),
    } satisfies SchemaShape<ToolPyproject['project']>),
    tool: z.object({
        uv: z.object({ package: z.literal(false) } satisfies SchemaShape<ToolPyproject['tool']['uv']>),
    } satisfies SchemaShape<ToolPyproject['tool']>),
}) satisfies z.ZodType<ToolPyproject>;
