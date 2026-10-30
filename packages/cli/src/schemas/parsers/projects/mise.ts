import { z } from 'zod';

const taskSchema = z.looseObject({
    alias: z.union([z.string(), z.string().array()]).optional(),
});
const taskValueSchema = z.union([z.string(), z.string().array(), taskSchema]);

export const miseTasksSchema = z.object({
    tasks: z.record(z.string(), taskValueSchema).default({}),
});
