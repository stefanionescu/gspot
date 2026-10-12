import { z } from 'zod';
import type { SchemaShape } from '#cli/types/objects.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import type { ParsedSettings, TemplateTables, WrittenSettings } from '#cli/types/settings/file.ts';

/** Reusable root settings without repository scope records. */
export const templateSchema = settingsSchema.safeExtend({ scope: z.never().optional() } satisfies SchemaShape<
    Pick<ParsedSettings, 'scope'>,
    Pick<WrittenSettings, 'scope'>
>) satisfies z.ZodType<Omit<ParsedSettings, 'scope'>, TemplateTables>;
