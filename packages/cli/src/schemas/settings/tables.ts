import { z } from 'zod';
import semver from 'semver';
import { isTable } from '#cli/system/tables.ts';
import parseExpression from 'spdx-expression-parse';
import { SETTING_LANGUAGES } from '#cli/config/manifests.ts';
import type { ImportRule, SettingsError, NamingCategory, SettingLanguage } from '#cli/types/settings.ts';

import {
    commandSchema,
    nonemptyStringSchema,
    namingOverrideSchema,
    operatingSystemSchema,
} from '#cli/schemas/manifests/tools.ts';
import {
    allowReasonedValue,
    relativePathSchema,
    nonemptyPathsSchema,
    namingCategorySchema,
} from '#cli/schemas/settings/fields.ts';
import {
    CI_PINS,
    CI_PROVIDERS,
    GITHUB_ONLY_CI_KEYS,
    NAMING_TABLE_CATEGORIES,
    NAMING_LANGUAGE_CATEGORIES,
} from '#cli/config/settings/schema.ts';

export const ciFields = {
    enabled: z.boolean().default(false).meta({
        template: 'ci',
        description: 'Whether gspot writes a CI workflow; set it at the root only.',
    }),
    provider: z.enum(CI_PROVIDERS).default('github').meta({
        template: 'ci',
        description: 'Which CI service gets the workflow; set it at the root only.',
    }),
    setup_command: commandSchema.optional().meta({
        template: 'code',
        description: 'A command CI runs before `gspot install`, in place of the frozen install of each lockfile.',
    }),
    operating_systems: operatingSystemSchema
        .array()
        .min(1)
        .default(['linux'] as ['linux'])
        .meta({
            description: 'The operating systems of the CI jobs. GitHub only; refused with provider = "gitlab".',
        }),
    linux_runner: z.string().min(1).default(CI_PINS.githubRunners.linux.label).meta({
        description:
            'The GitHub runner label of the Linux job, such as a larger or self-hosted runner. GitHub only; refused with provider = "gitlab".',
    }),
};

export const ciSchema = z
    .strictObject({
        ...ciFields,
        operating_systems: ciFields.operating_systems
            .unwrap()
            .optional()
            .meta({ ...ciFields.operating_systems.meta(), default: ciFields.operating_systems.parse(undefined) }),
        linux_runner: ciFields.linux_runner
            .unwrap()
            .optional()
            .meta({ ...ciFields.linux_runner.meta(), default: ciFields.linux_runner.parse(undefined) }),
    })
    .superRefine((ci, context) => {
        for (const key of GITHUB_ONLY_CI_KEYS)
            if (ci.provider === 'gitlab' && ci[key] !== undefined)
                context.addIssue({
                    code: 'custom',
                    path: [key],
                    message: `ci.${key} is GitHub only. Remove it when ci.provider is "gitlab".`,
                });
    })
    .transform((ci) => ({
        ...ci,
        operating_systems: ci.operating_systems ?? ciFields.operating_systems.parse(undefined),
        linux_runner: ci.linux_runner ?? ciFields.linux_runner.parse(undefined),
    }))
    .meta({
        allOf: [
            {
                if: { type: 'object', properties: { provider: { const: 'gitlab' } }, required: ['provider'] },
                // eslint-disable-next-line unicorn/no-thenable -- reason: JSON Schema defines this conditional keyword.
                then: { type: 'object', properties: { operating_systems: false, linux_runner: false } },
            },
        ],
    });

export const hooksSchema = z.strictObject({
    enabled: z.boolean().default(false).meta({
        description: 'Install and run the configured Git hooks.',
    }),
});

const importRuleSchema = z.strictObject({
    name: z.string().min(1).meta({
        description: 'The name that other import rules use in can_import.',
    }),
    paths: nonemptyPathsSchema.meta({
        description: 'The files of the import rule.',
    }),
    can_import: z.string().array().optional().meta({
        description:
            'Exactly the import rules whose files this rule may import, besides its own. Replaces the rules listed above it.',
    }),
});

function validateImportRules(rules: ImportRule[]): SettingsError[] {
    const names = new Set(rules.map((rule) => rule.name));
    return rules.flatMap((rule, index) =>
        (rule.can_import ?? []).flatMap((name, edge) =>
            names.has(name)
                ? []
                : { path: [index, 'can_import', edge], message: `There is no import rule called ${name}.` },
        ),
    );
}

export const importRulesSchema = importRuleSchema
    .array()
    .superRefine((rules, context) => {
        for (const { path, message } of validateImportRules(rules))
            context.addIssue({ code: 'custom', path: [...path], message });
    })
    .default([] as [])
    .meta({
        configurations: ['structure'],
        description:
            'Code may import its own files and the files of every import rule listed above it, never below. can_import replaces the rules above with an exact list. When import rules exist, every code file belongs to one, apart from tests, tool settings files, scripts, and generated files.',
    });

export const javascriptSchema = z
    .strictObject({
        script_files: allowReasonedValue(relativePathSchema.array(), {
            reason_when: 'adding',
            configurations: ['javascript'],
            description: 'Script files, which may print to the console and call process.exit.',
            default: ['scripts/**', '**/*.config.{js,mjs,cjs,ts}'] as ['scripts/**', '**/*.config.{js,mjs,cjs,ts}'],
        }),
        import_boundaries: relativePathSchema
            .array()
            .default([] as [])
            .meta({
                configurations: ['javascript'],
                description:
                    'Folders, relative to the repository root, that a relative import may not leave, such as src/features/*. An import of a file outside them takes the alias, and eslint --fix writes it.',
            }),
        externals: allowReasonedValue(z.string().min(1).array(), {
            reason_when: 'adding',
            template: 'repository',
            configurations: ['javascript'],
            description:
                'Import specifiers that the runtime provides, such as ../../scripts/app.js in a host application. Globs match several.',
            default: [] as [],
        }),
    })
    .optional();

export const pythonSchema = z
    .strictObject({
        externals: allowReasonedValue(z.string().min(1).array(), {
            reason_when: 'adding',
            template: 'repository',
            configurations: ['python'],
            description:
                'Modules that the host application provides at run time, such as folder_paths. A name covers its submodules.',
            default: [] as [],
        }),
        import_folders: relativePathSchema
            .array()
            .default([] as [])
            .meta({
                configurations: ['python'],
                description:
                    'Folders, relative to the scope, that Python imports resolve from, for basedpyright and the import rules check.',
            }),
    })
    .optional();

const allowedPackageSchema = z.strictObject({
    name: nonemptyStringSchema.meta({
        description:
            'The package name, such as `lightningcss`, or a glob that covers one package built for each platform, such as `@img/sharp-libvips-*`.',
    }),
    version: z
        .string()
        .refine(
            (range) => semver.validRange(range) !== null,
            'Name an exact version, a semver range such as ^1.2.0, or * for every version.',
        )
        .meta({
            description:
                'An exact version, a version range such as `^1.2.0`, or `*`; gspot reports a record that matches no locked package.',
        }),
    reason: z.string().meta({
        description: 'Why you accept its license; name the license here.',
    }),
});

export const licensesSchema = z.strictObject({
    allowed: nonemptyStringSchema
        .refine((id) => {
            try {
                const expression = parseExpression(id);
                return isTable(expression) && 'license' in expression;
            } catch {
                return false;
            }
        }, 'Use one SPDX license ID, such as MIT or Apache-2.0, not an AND or OR expression.')
        .array()
        .default([] as [])
        .meta({
            configurations: ['licenses'],
            description: 'The SPDX license IDs a dependency may report.',
        }),
    allowed_package: allowedPackageSchema
        .array()
        .default([] as [])
        .meta({
            template: 'repository',
            configurations: ['licenses'],
            description: 'Packages accepted under a license outside the list: name, exact version, and reason.',
        }),
});

const languageSchema = namingCategorySchema.extend(
    Object.fromEntries(
        NAMING_TABLE_CATEGORIES.map((category) => [
            category,
            namingCategorySchema
                .optional()
                .describe(`Naming rules for ${category}.`)
                .meta({ variantOf: 'naming.<language>' }),
        ]),
    ) as Record<NamingCategory, z.ZodOptional<typeof namingCategorySchema>>,
);

const languageSchemas = Object.fromEntries(
    Object.entries(NAMING_LANGUAGE_CATEGORIES).map(([language, categories]) => [
        language,
        languageSchema
            .pick(
                Object.fromEntries(
                    [...Object.keys(namingCategorySchema.shape), ...categories].map((name) => [name, true]),
                ) as Record<keyof typeof languageSchema.shape, true>,
            )
            .describe(`Naming rules for ${language} files, folders, and identifiers.`)
            .meta({ variantOf: 'naming' }),
    ]),
) as Record<SettingLanguage, typeof languageSchema>;

languageSchema.register(z.globalRegistry, { id: 'namingLanguage' });

const lists = {
    banned_words: z
        .string()
        .array()
        .default([] as [])
        .meta({
            configurations: ['naming'],
            description: 'Words this repository bans in identifiers, beyond the shipped groups.',
        }),
    override: namingOverrideSchema
        .extend({
            paths: nonemptyPathsSchema
                .default(['**'] as ['**'])
                .describe(namingOverrideSchema.shape.paths.description as string),
            languages: z
                .enum(SETTING_LANGUAGES)
                .array()
                .optional()
                .describe(namingOverrideSchema.shape.languages.description as string),
            allow_digits: namingOverrideSchema.shape.allow_digits.default(false),
            allow_repeated_words: namingOverrideSchema.shape.allow_repeated_words.default(false),
            reason: z.string().describe(namingOverrideSchema.shape.reason.description as string),
        })
        .array()
        .default([] as [])
        .meta({
            configurations: ['naming'],
            description: 'Naming rules for repository-relative paths, in order; each record has its reason.',
        }),
};

export const namingSchema = z.strictObject({
    ...namingCategorySchema.shape,
    ...lists,
    typescript: languageSchemas['typescript'].optional(),
    javascript: languageSchemas['javascript'].optional(),
    python: languageSchemas['python'].optional(),
    swift: languageSchemas['swift'].optional(),
    bash: languageSchemas['bash'].optional(),
    sql: languageSchemas['sql'].optional(),
    css: languageSchemas['css'].optional(),
    html: languageSchemas['html'].optional(),
});

export const rulesSchema = z.strictObject({
    enabled: z.boolean().default(true).meta({
        description: 'Write the rules and the AGENTS.md block.',
    }),
    exclude: z
        .string()
        .array()
        .default([] as [])
        .meta({
            description:
                'Rule files or folders under .gspot/configurations/ to leave out, such as .gspot/configurations/general/engineering/rules/PLANNING.md.',
        }),
});
