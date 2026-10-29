import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { RuntimePins } from '#tests/types/runner.ts';

export const runtimePinsSchema = z.object({
    tools: z.object({ bun: z.string(), node: z.string() } satisfies SchemaShape<RuntimePins['tools']>),
} satisfies SchemaShape<RuntimePins>);
