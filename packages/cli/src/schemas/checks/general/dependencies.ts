import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { MiseTools } from '#cli/types/checks/general/dependencies.ts';

export const miseToolsSchema = z.looseObject({
    tools: z.record(z.string(), z.unknown()).default({}),
} satisfies SchemaShape<MiseTools>);
