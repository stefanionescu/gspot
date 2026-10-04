import { z } from 'zod';

export const deptrySchema = z.object({
    tool: z
        .object({
            deptry: z.object({ extend_exclude: z.array(z.string()).default([]) }).default({ extend_exclude: [] }),
        })
        .default({ deptry: { extend_exclude: [] } }),
});
