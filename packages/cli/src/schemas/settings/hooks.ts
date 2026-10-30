import { z } from 'zod';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';

export const hooksSchema = z.strictObject({
    enabled: z
        .boolean()
        .default(SETTING_DEFINITIONS['hooks.enabled'].default)
        .meta(SETTING_DEFINITIONS['hooks.enabled']),
});
