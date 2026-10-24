import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { DeptryConfiguration } from '#cli/types/checks/language/python.ts';

const toolDeptrySchema = z.object({
    extend_exclude: z.string().array().default([]),
    known_first_party: z.string().array().default([]),
} satisfies SchemaShape<DeptryConfiguration['tool']['deptry']>);

export const deptrySchema = z.object({
    tool: z
        .object({
            deptry: toolDeptrySchema.default({ extend_exclude: [], known_first_party: [] }),
        } satisfies SchemaShape<DeptryConfiguration['tool']>)
        .default({ deptry: { extend_exclude: [], known_first_party: [] } }),
} satisfies SchemaShape<DeptryConfiguration>);
