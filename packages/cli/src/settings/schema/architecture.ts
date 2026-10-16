import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { TableSettings } from '#cli/types/settings/tables.ts';
import type { WrittenArchitecture } from '#cli/types/settings/file.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import { relativePath, nonemptyPaths } from '#cli/settings/schema/parts.ts';

const architectureRolesSchema = z.strictObject({
    environment_readers: z
        .array(relativePath)
        .default([])
        .meta({
            configurations: ['structure'],
            description: 'Repository-relative paths that may read environment values.',
        }),
} satisfies SchemaShape<
    Pick<TableSettings<'architecture'>['roles'], 'environment_readers'>,
    Pick<NonNullable<WrittenArchitecture['roles']>, 'environment_readers'>
>);

const architectureSchema = z
    .strictObject({
        module: z
            .array(
                z.strictObject({
                    name: z.string().min(1).describe(SETTING_DECLARATIONS['architecture.module.name'].description),
                    paths: nonemptyPaths.describe(SETTING_DECLARATIONS['architecture.module.paths'].description),
                    may_import: z
                        .array(z.string())
                        .default([])
                        .describe(SETTING_DECLARATIONS['architecture.module.may_import'].description),
                } satisfies SchemaShape<
                    TableSettings<'architecture'>['module'][number],
                    NonNullable<WrittenArchitecture['module']>[number]
                >),
            )
            .default([])
            .meta({
                configurations: ['structure'],
                description:
                    'A module may import itself, the modules listed before it, and the modules in its may_import list.',
            }),
        roles: z
            .strictObject({
                ...architectureRolesSchema.shape,
                scripts: z
                    .array(relativePath)
                    .default(['scripts/**', '**/*.config.{js,mjs,cjs,ts}'])
                    .meta({
                        configurations: ['javascript'],
                        description: 'Globs for script files: they may print to the console and call process.exit.',
                    }),
                stores: z
                    .array(relativePath)
                    .default(['**/store.*', '**/stores/*', '**/store/*', '**/*.store.*'])
                    .meta({ configurations: ['zustand'], description: 'The files that may create a store.' }),
                routers: z
                    .array(relativePath)
                    .default(['**/routers/**', '**/*router*.ts', '**/trpc/**'])
                    .meta({ configurations: ['trpc'], description: 'The files that declare tRPC procedures.' }),
            } satisfies SchemaShape<
                NonNullable<TableSettings<'architecture'>['roles']>,
                NonNullable<WrittenArchitecture['roles']>
            >)
            .prefault({})
            .meta({
                configurations: ['structure'],
                description:
                    'Repository paths that read environment values, plus roles declared by selected configurations such as scripts, stores, and routers. Each configuration supplies the defaults for its roles.',
            }),
    } satisfies SchemaShape<TableSettings<'architecture'>, WrittenArchitecture>)
    .superRefine((table, context) => {
        const names = new Set(table.module.map((module) => module.name));
        for (const [index, module] of table.module.entries())
            for (const [edge, name] of module.may_import.entries()) {
                if (!names.has(name))
                    context.addIssue({
                        code: 'custom',
                        path: ['module', index, 'may_import', edge],
                        message: `There is no architecture module named ${name}.`,
                    });
            }
    });

export { architectureSchema };
