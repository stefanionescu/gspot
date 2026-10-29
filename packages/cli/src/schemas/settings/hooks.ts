import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { Settings, WrittenSettings } from '#cli/types/settings/file.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';

export const hooksSchema = z.strictObject({
    enabled: z
        .boolean()
        .default(SETTING_DEFINITIONS['hooks.enabled'].default)
        .meta(SETTING_DEFINITIONS['hooks.enabled']),
} satisfies SchemaShape<NonNullable<Settings['hooks']>, NonNullable<WrittenSettings['hooks']>>);
