import { z } from 'zod';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { relativePathSchema, allowReasonedValue } from '#cli/schemas/settings/fields.ts';

export const javascriptSchema = z
    .strictObject({
        script_files: allowReasonedValue(relativePathSchema.array(), SETTING_DEFINITIONS['javascript.script_files']),
        import_boundaries: relativePathSchema
            .array()
            .default(SETTING_DEFINITIONS['javascript.import_boundaries'].default)
            .meta(SETTING_DEFINITIONS['javascript.import_boundaries']),
        externals: allowReasonedValue(z.string().min(1).array(), SETTING_DEFINITIONS['javascript.externals']),
    })
    .optional();

export const pythonSchema = z
    .strictObject({
        externals: allowReasonedValue(z.string().min(1).array(), SETTING_DEFINITIONS['python.externals']),
        import_folders: relativePathSchema
            .array()
            .default(SETTING_DEFINITIONS['python.import_folders'].default)
            .meta(SETTING_DEFINITIONS['python.import_folders']),
    })
    .optional();
