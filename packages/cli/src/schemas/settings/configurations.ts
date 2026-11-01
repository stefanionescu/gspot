import { z } from 'zod';
import { limitsSchema } from '#cli/schemas/settings/limits.ts';
import type { ToolTableSchemas } from '#cli/types/settings.ts';
import { FROZEN_ALL, FROZEN_NONE } from '#cli/config/parsers.ts';
import { BUILD_SCRIPT } from '#cli/config/settings/validation.ts';
import { toolsSchema, javascriptSchema } from '#cli/schemas/settings/tools.ts';
import { FROZEN_VERSION, TABLE_DESCRIPTIONS } from '#cli/config/settings/schema.ts';
import { hooksSchema, generalTableSchemas } from '#cli/schemas/settings/general.ts';
import { commandSchema, nonemptyStringSchema } from '#cli/schemas/manifests/tools.ts';
import { ciFields, namingSchema, pythonSchema, ruleFilesSchema } from '#cli/schemas/settings/tables.ts';

import {
    formatSchema,
    relativePathSchema,
    allowReasonedValue,
    destinationPathSchema,
    nonemptyStringsSchema,
} from '#cli/schemas/settings/fields.ts';

export const configurationTableSchemas = {
    format: formatSchema.optional(),
    limits: limitsSchema.optional(),
    naming: namingSchema.optional(),
    structure: generalTableSchemas.structure,
    cloudflare: z
        .strictObject({
            types_file: destinationPathSchema.default('worker-configuration.d.ts').meta({
                configurations: ['cloudflare'],
                description:
                    'Tracked Worker types file from the repository root; OpenNext defaults to cloudflare-env.d.ts.',
            }),
            types_interface: nonemptyStringSchema.default('Env').meta({
                leftOut: 'repository',
                configurations: ['cloudflare'],
                description: 'Environment interface name passed to wrangler types; OpenNext defaults to CloudflareEnv.',
            }),
        })
        .optional(),
    coverage: generalTableSchemas.coverage,
    dependencies: generalTableSchemas.dependencies,
    docs: generalTableSchemas.docs,
    drizzle: z
        .strictObject({
            client_names: nonemptyStringsSchema.default(['db'] as ['db']).meta({
                leftOut: 'repository',
                configurations: ['drizzle'],
                description:
                    'The Drizzle client identifiers checked for update and delete operations without a where clause.',
            }),
        })
        .optional(),
    javascript: javascriptSchema,
    python: pythonSchema,
    trpc: z
        .strictObject({
            router_files: relativePathSchema
                .array()
                .default(['**/routers/**', '**/*router*.ts', '**/trpc/**'] as [
                    '**/routers/**',
                    '**/*router*.ts',
                    '**/trpc/**',
                ])
                .meta({
                    configurations: ['trpc'],
                    description: 'The files that declare tRPC procedures.',
                }),
            server_files: relativePathSchema
                .array()
                .default([] as [])
                .meta({
                    configurations: ['trpc'],
                    description:
                        'The server files that other files of a tRPC scope may import only as types; empty turns the rule off.',
                }),
        })
        .optional(),
    zustand: z
        .strictObject({
            store_files: allowReasonedValue(relativePathSchema.array(), {
                reason_when: 'adding',
                configurations: ['zustand'],
                description: 'The files that may create a store.',
                default: ['**/store.*', '**/stores/*', '**/store/*', '**/*.store.*'] as [
                    '**/store.*',
                    '**/stores/*',
                    '**/store/*',
                    '**/*.store.*',
                ],
            }),
        })
        .optional(),
    licenses: generalTableSchemas.licenses,
    openapi: z
        .strictObject({
            document: relativePathSchema.optional().meta({
                configurations: ['openapi'],
                description:
                    'The committed OpenAPI document, relative to the repository root, which init fills in when it finds one; without it, the OpenAPI checks do not run.',
            }),
            generate_command: commandSchema.optional().meta({
                leftOut: 'code',
                configurations: ['openapi'],
                description:
                    'The command that writes the OpenAPI document from the code, run in the project scope folder.',
            }),
        })
        .optional(),
    postgres: z
        .strictObject({
            client_schemas: nonemptyStringsSchema.default([] as []).meta({
                leftOut: 'repository',
                configurations: ['postgres'],
                description: 'The schemas clients reach, where every table needs row level security.',
            }),
            frozen_through: z
                .union([z.enum([FROZEN_NONE, FROZEN_ALL]), z.string().regex(FROZEN_VERSION)])
                .default('none')
                .meta({
                    leftOut: 'repository',
                    configurations: ['postgres'],
                    description:
                        'The last migration version that has run everywhere (none, all, or a version); Squawk skips those migrations, and they may not change.',
                }),
            migrations_folder: relativePathSchema.optional().meta({
                configurations: ['postgres'],
                description:
                    'The migrations folder, relative to the repository root; without it, the checks use the migration files of this configuration.',
            }),
        })
        .optional(),
    secrets: generalTableSchemas.secrets,
    site: z
        .strictObject({
            build_command: commandSchema.default(['npm', ...BUILD_SCRIPT] as string[]).meta({
                leftOut: 'code',
                configurations: ['site'],
                description:
                    'The command that builds the site. Without it, gspot runs the build script of the package manager.',
            }),
            build_folder: destinationPathSchema.default('dist').meta({
                configurations: ['site'],
                description: 'The folder the build writes.',
            }),
            allowed_unlisted_pages: allowReasonedValue(relativePathSchema.meta({ path_role: 'build' }).array(), {
                configurations: ['site'],
                description: 'Built pages the sitemap leaves out on purpose.',
                reason_when: 'adding',
                default: ['404.html'] as ['404.html'],
            }),
        })
        .optional(),
    spelling: generalTableSchemas.spelling,
    supabase: z
        .strictObject({
            functions_folder: relativePathSchema.default('supabase/functions').meta({
                configurations: ['supabase'],
                description:
                    'The folder, relative to the repository root, with one folder for each edge function; the default starts from the project scope.',
            }),
            schemas: nonemptyStringsSchema.default(['public'] as ['public']).meta({
                leftOut: 'repository',
                configurations: ['supabase'],
                description: 'The database schemas to include in generated types.',
            }),
            types_file: destinationPathSchema.optional().meta({
                configurations: ['supabase'],
                description:
                    'The committed database types file, relative to the repository root; without it, no type comparison runs.',
            }),
        })
        .optional(),
    translations: z
        .strictObject({
            base_locale: nonemptyStringSchema.default('en').meta({
                leftOut: 'repository',
                configurations: ['translations'],
                description: 'The locale whose message keys every other locale must contain.',
            }),
            messages_folder: relativePathSchema.optional().meta({
                configurations: ['translations'],
                description: 'The folder of the `<locale>.json` message files, relative to the repository root.',
            }),
        })
        .optional(),
    swift: z
        .strictObject({
            xcode_project: relativePathSchema.optional().meta({
                configurations: ['swift'],
                description:
                    'The Xcode project or workspace, relative to the repository root, which init fills in when it finds one; without it, the checks use the Swift package.',
            }),
            xcode_scheme: nonemptyStringSchema.optional().meta({
                leftOut: 'repository',
                configurations: ['swift'],
                description: 'The shared scheme the build, the analyzer, and Periphery use.',
            }),
            xcode_destination: nonemptyStringSchema.default('generic/platform=iOS Simulator').meta({
                leftOut: 'repository',
                configurations: ['swift'],
                description: 'The xcodebuild destination.',
            }),
        })
        .optional(),
    repository: generalTableSchemas.repository,
    prose: generalTableSchemas.prose,
    duplication: generalTableSchemas.duplication,
    xcode: z
        .strictObject({
            allowed_entitlements: z
                .string()
                .array()
                .default([] as [])
                .meta({
                    leftOut: 'repository',
                    configurations: ['xcode'],
                    description: 'The entitlements the app may hold; empty turns the check off.',
                }),
        })
        .optional(),
};

const toolTableSchemas = Object.fromEntries<z.ZodType>(
    Object.entries(toolsSchema.shape).map(([tool, schema]) => [`tools.${tool}`, schema]),
) as ToolTableSchemas;

export const tableValuesSchema = z.strictObject({
    ...configurationTableSchemas,
    format: formatSchema.prefault({}),
    ...toolTableSchemas,
});

for (const [name, schema] of Object.entries(configurationTableSchemas)) {
    const description = TABLE_DESCRIPTIONS[name];
    if (description !== undefined)
        z.globalRegistry.add(schema, {
            ...schema.meta(),
            ...(schema.unwrap().meta()?.id === undefined ? { id: name } : {}),
            description,
        });
}

export const tableSettingSchemas = Object.fromEntries(
    Object.entries({ hooks: hooksSchema.shape, ci: ciFields, rule_files: ruleFilesSchema.shape }).flatMap(
        ([section, fields]) =>
            Object.entries<z.ZodType>(fields).map(
                ([key, field]) =>
                    [
                        `${section}.${key}`,
                        field.safeParse(undefined).success ? field : field.optional().describe(field.description ?? ''),
                    ] as const,
            ),
    ),
);
