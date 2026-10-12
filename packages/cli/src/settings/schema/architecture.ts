import { z } from 'zod';
import type { SchemaShape } from '#cli/types/objects.ts';
import type { TableSettings } from '#cli/types/settings/tables.ts';
import { RECORD_DESCRIPTIONS } from '#cli/config/settings/defaults.ts';
import type { WrittenArchitecture } from '#cli/types/settings/file.ts';
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

export const architectureSchema = z
    .strictObject({
        module: z
            .array(
                z.strictObject({
                    name: z.string().min(1).describe(RECORD_DESCRIPTIONS.module_name),
                    paths: nonemptyPaths.describe(RECORD_DESCRIPTIONS.module_paths),
                    may_import: z.array(z.string()).default([]).describe(RECORD_DESCRIPTIONS.module_may_import),
                } satisfies SchemaShape<
                    TableSettings<'architecture'>['module'][number],
                    NonNullable<WrittenArchitecture['module']>[number]
                >),
            )
            .default([])
            .meta({
                configurations: ['structure'],
                description:
                    'Which module may import which; a module imports itself and the modules in its may_import list',
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
