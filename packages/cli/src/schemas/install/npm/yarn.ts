import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { YarnSetting } from '#cli/types/tools/project.ts';

export const yarnConnectionSettingsSchema = z.record(z.string(), z.unknown()) satisfies z.ZodType<
    Record<string, unknown>
>;

export const yarnConfigEntrySchema = z.object({
    key: z.string(),
} satisfies SchemaShape<YarnSetting>) satisfies z.ZodType<YarnSetting>;
