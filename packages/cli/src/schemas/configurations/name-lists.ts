import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { NameList } from '#cli/types/configurations.ts';

export const nameListSchema = z.strictObject({
    package: z.string().min(1),
    version: z.string().min(1),
    names: z.string().min(1).array(),
} satisfies SchemaShape<NameList>);
