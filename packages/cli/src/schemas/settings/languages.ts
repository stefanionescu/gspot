import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { relativePath } from '#cli/schemas/settings/parts.ts';
import type { WrittenSettings } from '#cli/types/settings/file.ts';
import type { TableSettings } from '#cli/types/settings/tables.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';

const javascriptSchema = z
    .strictObject({
        script_files: z
            .array(relativePath)
            .default(SETTING_DECLARATIONS['javascript.script_files'].default)
            .meta(SETTING_DECLARATIONS['javascript.script_files']),
        externals: z
            .array(z.string().min(1))
            .default(SETTING_DECLARATIONS['javascript.externals'].default)
            .meta(SETTING_DECLARATIONS['javascript.externals']),
    } satisfies SchemaShape<TableSettings<'javascript'>, NonNullable<WrittenSettings['javascript']>>)
    .optional();

const pythonSchema = z
    .strictObject({
        externals: z
            .array(z.string().min(1))
            .default(SETTING_DECLARATIONS['python.externals'].default)
            .meta(SETTING_DECLARATIONS['python.externals']),
        extra_paths: z
            .array(relativePath)
            .default(SETTING_DECLARATIONS['python.extra_paths'].default)
            .meta(SETTING_DECLARATIONS['python.extra_paths']),
    } satisfies SchemaShape<TableSettings<'python'>, NonNullable<WrittenSettings['python']>>)
    .optional();

export { pythonSchema, javascriptSchema };
