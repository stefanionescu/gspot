import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { MiseTask, MiseTasks } from '#cli/types/parsers/projects/mise.ts';

const tasksSchema = z.looseObject({
    alias: z.union([z.string(), z.string().array()]).optional(),
} satisfies SchemaShape<MiseTask>);
const taskValueSchema = z.union([z.string(), z.string().array(), tasksSchema]) satisfies z.ZodType<
    MiseTasks['tasks'][string]
>;

export const miseTasksSchema = z.object({
    tasks: z.record(z.string(), taskValueSchema).default({}),
} satisfies SchemaShape<MiseTasks>);
