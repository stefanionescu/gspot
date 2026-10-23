import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { relativePath } from '#cli/schemas/settings/fields.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { type TableSettings, type WrittenSettings } from '#cli/types/settings/file.ts';

export const javascriptSchema = z
    .strictObject({
        script_files: z
            .array(relativePath)
            .default(SETTING_DEFINITIONS['javascript.script_files'].default)
            .meta(SETTING_DEFINITIONS['javascript.script_files']),
        import_boundaries: z
            .array(relativePath)
            .default(SETTING_DEFINITIONS['javascript.import_boundaries'].default)
            .meta(SETTING_DEFINITIONS['javascript.import_boundaries']),
        externals: z
            .array(z.string().min(1))
            .default(SETTING_DEFINITIONS['javascript.externals'].default)
            .meta(SETTING_DEFINITIONS['javascript.externals']),
    } satisfies SchemaShape<TableSettings<'javascript'>, NonNullable<WrittenSettings['javascript']>>)
    .optional();

export const pythonSchema = z
    .strictObject({
        externals: z
            .array(z.string().min(1))
            .default(SETTING_DEFINITIONS['python.externals'].default)
            .meta(SETTING_DEFINITIONS['python.externals']),
        extra_paths: z
            .array(relativePath)
            .default(SETTING_DEFINITIONS['python.extra_paths'].default)
            .meta(SETTING_DEFINITIONS['python.extra_paths']),
    } satisfies SchemaShape<TableSettings<'python'>, NonNullable<WrittenSettings['python']>>)
    .optional();
