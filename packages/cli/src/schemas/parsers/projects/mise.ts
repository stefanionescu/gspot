import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { MiseTask, MiseTasks } from '#cli/types/parsers/projects/mise.ts';

export const miseTasksSchema = z.object({
    tasks: z
        .record(
            z.string(),
            z.union([
                z.string(),
                z.array(z.string()),
                z.looseObject({
                    alias: z.union([z.string(), z.array(z.string())]).optional(),
                } satisfies SchemaShape<MiseTask>),
            ]),
        )
        .default({}),
} satisfies SchemaShape<MiseTasks>);
