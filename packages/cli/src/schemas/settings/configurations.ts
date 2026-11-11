import { z } from 'zod';

import { FROZEN_ALL, FROZEN_NONE, FROZEN_VERSION, TABLE_DESCRIPTIONS } from '#cli/config/settings/schema.ts';
import { commandSchema } from '#cli/schemas/manifests/checks.ts';
import { nonemptyStringSchema } from '#cli/schemas/manifests/tools.ts';
import {
    allowReasonedValue,
    destinationPathSchema,
    formatSchema,
    nonemptyStringsSchema,
    relativePathSchema,
} from '#cli/schemas/settings/fields.ts';
import { generalTableSchemas, hooksSchema } from '#cli/schemas/settings/general.ts';
import { limitsSchema } from '#cli/schemas/settings/limits.ts';
import { commitsSchema } from '#cli/schemas/settings/rules.ts';
import { ciFields, namingSchema, pythonSchema, ruleFilesSchema } from '#cli/schemas/settings/tables.ts';
import { javascriptSchema, toolConfigurationSchemas, toolsSchema } from '#cli/schemas/settings/tools.ts';
import type { ToolTableSchemas } from '#cli/types/settings.ts';

function describeConfigurationTables<Tables extends Record<string, z.ZodOptional<z.ZodType>>>(tables: Tables): Tables {
    for (const [name, schema] of Object.entries(tables)) {
        const description = TABLE_DESCRIPTIONS[name];
        if (description !== undefined)
            z.globalRegistry.add(schema, {
                ...schema.meta(),
                ...(schema.unwrap().meta()?.id === undefined && { id: name }),
                description,
            });
    }
    return tables;
}

const configurationTables = {
    format: formatSchema.optional(),
    limits: limitsSchema.optional(),
    naming: namingSchema.optional(),
    structure: generalTableSchemas.structure,
    commits: commitsSchema,
    ...toolConfigurationSchemas,
    cloudflare: z
        .strictObject({
            types_file: destinationPathSchema.default('worker-configuration.d.ts').meta({
                configurations: ['cloudflare'],
                description:
                    'The committed file that holds the Worker types. gspot sets it to `cloudflare-env.d.ts` in an OpenNext project.',
            }),
            types_interface: nonemptyStringSchema.default('Env').meta({
                leftOut: 'repository',
                configurations: ['cloudflare'],
                description:
                    'The environment interface name that `wrangler types` writes. gspot sets it to `CloudflareEnv` in an OpenNext project.',
            }),
        })
        .optional(),
    coverage: generalTableSchemas.coverage,
    dependencies: generalTableSchemas.dependencies,
    docs: generalTableSchemas.docs,
    drizzle: z
        .strictObject({
            client_names: nonemptyStringsSchema.default(['db']).meta({
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
                .default(['**/routers/**', '**/*router*.ts', '**/trpc/**'])
                .meta({
                    configurations: ['trpc'],
                    description: 'The files that declare tRPC procedures.',
                }),
            server_files: relativePathSchema
                .array()
                .default([])
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
                reason_for: 'adding',
                configurations: ['zustand'],
                description: 'The files that may create a store.',
                default: ['**/store.*', '**/stores/*', '**/store/*', '**/*.store.*'],
            }),
        })
        .optional(),
    licenses: generalTableSchemas.licenses,
    openapi: z
        .strictObject({
            document: relativePathSchema.optional().meta({
                configurations: ['openapi'],
                description:
                    'The committed OpenAPI document, which init fills in when it finds one; without it, the OpenAPI checks do not run.',
            }),
            generate_command: commandSchema.optional().meta({
                leftOut: 'code',
                configurations: ['openapi'],
                description:
                    'The command that writes the OpenAPI document from the code, run in the folder of the scope.',
            }),
        })
        .optional(),
    postgres: z
        .strictObject({
            client_schemas: nonemptyStringsSchema.default([]).meta({
                leftOut: 'repository',
                configurations: ['postgres'],
                description:
                    'The schemas clients reach, where every table needs row level security. Empty turns the check off.',
            }),
            frozen_through: z
                .union([z.enum([FROZEN_NONE, FROZEN_ALL]), z.string().regex(FROZEN_VERSION)])
                .default('none')
                .meta({
                    leftOut: 'repository',
                    configurations: ['postgres'],
                    description:
                        'The last migration version that has run everywhere (none, all, or a version); Squawk and the grants check skip those migrations.',
                }),
            assume_in_transaction: z
                .boolean()
                .default(true)
                .meta({
                    leftOut: 'repository',
                    configurations: ['postgres'],
                    description: 'Whether the migration runner wraps every migration in a transaction.',
                }),
            migrations_folder: relativePathSchema.optional().meta({
                configurations: ['postgres'],
                description:
                    'The migrations folder; without it, the checks use the migration files of this configuration.',
            }),
        })
        .optional(),
    secrets: generalTableSchemas.secrets,
    site: z
        .strictObject({
            build_command: commandSchema.optional().meta({
                leftOut: 'code',
                configurations: ['site'],
                description:
                    'The command that builds the site. Without it, gspot runs the build script with the package manager of the repository.',
            }),
            build_folder: destinationPathSchema.default('dist').meta({
                configurations: ['site'],
                description: 'The folder the build writes.',
            }),
            allowed_classes: allowReasonedValue(nonemptyStringsSchema, {
                leftOut: 'repository',
                configurations: ['site'],
                description: 'Class names that a script adds at run time, which the unused CSS check keeps.',
                reason_for: 'adding',
                default: [],
            }),
            allowed_unlisted_pages: allowReasonedValue(relativePathSchema.meta({ path_role: 'build' }).array(), {
                configurations: ['site'],
                description: 'Built pages the sitemap leaves out on purpose.',
                reason_for: 'adding',
                default: ['404.html'],
            }),
        })
        .optional(),
    spelling: generalTableSchemas.spelling,
    supabase: z
        .strictObject({
            functions_folder: relativePathSchema.default('supabase/functions').meta({
                configurations: ['supabase'],
                description: 'The folder with one folder for each edge function.',
            }),
            schemas: nonemptyStringsSchema.default(['public']).meta({
                leftOut: 'repository',
                configurations: ['supabase'],
                description: 'The database schemas to include in generated types.',
            }),
            types_file: destinationPathSchema.optional().meta({
                configurations: ['supabase'],
                description: 'The committed database types file; without it, no type comparison runs.',
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
                description: 'The folder of the `<locale>.json` message files.',
            }),
        })
        .optional(),
    swift: z
        .strictObject({
            xcode_project: relativePathSchema.optional().meta({
                configurations: ['swift'],
                description:
                    'The Xcode project or workspace, which init fills in when it finds one; without it, the checks use the Swift package.',
            }),
            xcode_scheme: nonemptyStringSchema.optional().meta({
                leftOut: 'repository',
                configurations: ['swift'],
                description: 'The shared scheme the build, the analyzer, and Periphery use.',
            }),
            allowed_unused_imports: z
                .string()
                .array()
                .default([])
                .meta({
                    leftOut: 'repository',
                    configurations: ['swift'],
                    description: 'Imports the analyzer keeps although it sees no use of them.',
                }),
            xcode_destination: nonemptyStringSchema.default('generic/platform=iOS Simulator').meta({
                leftOut: 'repository',
                configurations: ['swift'],
                description: 'The `-destination` that xcodebuild builds for.',
            }),
        })
        .optional(),
    repository: generalTableSchemas.repository,
    prose: generalTableSchemas.prose,
    xcode: z
        .strictObject({
            allowed_entitlements: z
                .string()
                .array()
                .default([])
                .meta({
                    leftOut: 'repository',
                    configurations: ['xcode'],
                    description: 'The entitlements the app may hold; empty turns the check off.',
                }),
        })
        .optional(),
};

export const configurationTableSchemas = describeConfigurationTables(configurationTables);

const toolTableSchemas = Object.fromEntries<z.ZodType>(
    Object.entries(toolsSchema.shape).map(([tool, schema]) => [`tools.${tool}`, schema]),
) as ToolTableSchemas;

export const tableValuesSchema = z.strictObject({
    ...configurationTableSchemas,
    format: formatSchema.prefault({}),
    ...toolTableSchemas,
});

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
