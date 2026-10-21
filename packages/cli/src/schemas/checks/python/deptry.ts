import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { DeptryConfiguration } from '#cli/types/checks/python.ts';

export const deptrySchema = z.object({
    tool: z
        .object({
            deptry: z
                .object({
                    extend_exclude: z.array(z.string()).default([]),
                    known_first_party: z.array(z.string()).default([]),
                } satisfies SchemaShape<DeptryConfiguration['tool']['deptry']>)
                .default({ extend_exclude: [], known_first_party: [] }),
        } satisfies SchemaShape<DeptryConfiguration['tool']>)
        .default({ deptry: { extend_exclude: [], known_first_party: [] } }),
} satisfies SchemaShape<DeptryConfiguration>) satisfies z.ZodType<DeptryConfiguration>;
