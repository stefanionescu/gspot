import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { SETTING_FACTS } from '#cli/config/settings/facts.ts';
import { relativePath } from '#cli/schemas/settings/parts.ts';
import { type TableSettings, type WrittenSettings } from '#cli/types/settings/file.ts';

export const javascriptSchema = z
    .strictObject({
        script_files: z
            .array(relativePath)
            .default(SETTING_FACTS['javascript.script_files'].default)
            .meta(SETTING_FACTS['javascript.script_files']),
        externals: z
            .array(z.string().min(1))
            .default(SETTING_FACTS['javascript.externals'].default)
            .meta(SETTING_FACTS['javascript.externals']),
    } satisfies SchemaShape<TableSettings<'javascript'>, NonNullable<WrittenSettings['javascript']>>)
    .optional();

export const pythonSchema = z
    .strictObject({
        externals: z
            .array(z.string().min(1))
            .default(SETTING_FACTS['python.externals'].default)
            .meta(SETTING_FACTS['python.externals']),
        extra_paths: z
            .array(relativePath)
            .default(SETTING_FACTS['python.extra_paths'].default)
            .meta(SETTING_FACTS['python.extra_paths']),
    } satisfies SchemaShape<TableSettings<'python'>, NonNullable<WrittenSettings['python']>>)
    .optional();
