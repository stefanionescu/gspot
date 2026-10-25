import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { MiseVersion, MiseLockfile } from '#cli/types/install/mise.ts';

const miseVersionSchema = z.looseObject({ version: z.string() } satisfies SchemaShape<MiseVersion>);

export const miseLockfileSchema = z.looseObject({
    tools: z.record(z.string(), miseVersionSchema.array()),
} satisfies SchemaShape<MiseLockfile>);
