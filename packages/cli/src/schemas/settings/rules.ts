import { z } from 'zod';
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
});
