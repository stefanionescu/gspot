import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { MisePin, MiseProject, MiseLockfile } from '#cli/types/install/mise.ts';

const misePinSchema = z.looseObject({ version: z.string() } satisfies SchemaShape<MisePin>);

export const miseLockfileSchema = z.looseObject({
    tools: z.record(z.string(), misePinSchema.array()),
} satisfies SchemaShape<MiseLockfile>);
const miseVersionSchema = z.union([z.string(), misePinSchema]) satisfies z.ZodType<string | MisePin>;

export const miseProjectSchema = z.looseObject({
    tools: z.record(z.string(), miseVersionSchema),
} satisfies SchemaShape<MiseProject>);
