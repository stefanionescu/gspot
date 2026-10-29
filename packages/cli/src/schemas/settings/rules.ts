import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { ParsedRules } from '#cli/types/settings/values.ts';
import type { WrittenSettings } from '#cli/types/settings/file.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';

export const rulesSchema = z.strictObject({
    enabled: z
        .boolean()
        .default(SETTING_DEFINITIONS['rules.enabled'].default)
        .meta(SETTING_DEFINITIONS['rules.enabled']),
    exclude: z
        .string()
        .array()
        .default(SETTING_DEFINITIONS['rules.exclude'].default)
        .meta(SETTING_DEFINITIONS['rules.exclude']),
} satisfies SchemaShape<ParsedRules, NonNullable<WrittenSettings['rules']>>);
