import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { relativePath } from '#cli/settings/schema/parts.ts';
import type { WrittenSettings } from '#cli/types/settings/file.ts';
import type { TableSettings } from '#cli/types/settings/tables.ts';

/** The [javascript] table: script files, and the modules the runtime provides. */
const javascriptSchema = z
    .strictObject({
        script_files: z
            .array(relativePath)
            .default(['scripts/**', '**/*.config.{js,mjs,cjs,ts}'])
            .meta({
                configurations: ['javascript'],
                description: 'Script files, which may print to the console and call process.exit.',
            }),
        externals: z
            .array(z.string().min(1))
            .default([])
            .meta({
                configurations: ['javascript'],
                description:
                    'Import specifiers that the runtime provides, such as ../../scripts/app.js in a host application. Globs match several.',
            }),
    } satisfies SchemaShape<TableSettings<'javascript'>, NonNullable<WrittenSettings['javascript']>>)
    .optional();

/** The [python] table: the modules the host application provides, and extra import folders. */
const pythonSchema = z
    .strictObject({
        externals: z
            .array(z.string().min(1))
            .default([])
            .meta({
                configurations: ['python'],
                description:
                    'Modules that the host application provides at run time, such as folder_paths. A name covers its submodules.',
            }),
        extra_paths: z
            .array(relativePath)
            .default([])
            .meta({
                configurations: ['python'],
                description: 'Folders, relative to the scope, where basedpyright also looks for imports.',
            }),
    } satisfies SchemaShape<TableSettings<'python'>, NonNullable<WrittenSettings['python']>>)
    .optional();

export { pythonSchema, javascriptSchema };
