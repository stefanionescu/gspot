import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { PurgecssRequest } from '#cli/types/checks/framework/site.ts';

export const purgecssRequestSchema = z.strictObject({
    configFile: z.string().min(1),
    css: z.array(z.string().min(1)),
    content: z.array(z.string().min(1)),
} satisfies SchemaShape<PurgecssRequest>);

export const processArgumentSchema = z.string();
