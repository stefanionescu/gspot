import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { PythonToolProject } from '#cli/types/tools/project.ts';

export const pythonToolProjectSchema = z.object({
    project: z.object({
        name: z.string(),
        version: z.string(),
        'requires-python': z.string(),
        dependencies: z.array(z.string()),
    } satisfies SchemaShape<PythonToolProject['project']>),
    tool: z.object({
        uv: z.object({ package: z.literal(false) } satisfies SchemaShape<PythonToolProject['tool']['uv']>),
    } satisfies SchemaShape<PythonToolProject['tool']>),
}) satisfies z.ZodType<PythonToolProject>;
