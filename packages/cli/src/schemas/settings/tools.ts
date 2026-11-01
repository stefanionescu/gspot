import { z } from 'zod';
import { nonemptyStringSchema } from '#cli/schemas/manifests/tools.ts';

import {
    allowReasonedValue,
    relativePathSchema,
    nonemptyPathsSchema,
    nonemptyStringsSchema,
} from '#cli/schemas/settings/fields.ts';
import {
    commitlintSchema,
    eslintRulesSchema,
    eslintPluginsSchema,
    buildRuleTableSchema,
    stylelintRulesSchema,
} from '#cli/schemas/settings/rules.ts';
import {
    TRIVY_SEVERITIES,
    KNIP_PACKAGE_NAME,
    SQLFLUFF_DIALECTS,
    MARKDOWNLINT_RULE_ID,
    DOCSTRING_CONVENTIONS,
    IMPORT_EXTENSION_STYLES,
    MARKDOWNLINT_RULE_ID_REFUSAL,
} from '#cli/config/settings/schema.ts';

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
            leftOut: 'repository',
            configurations: ['javascript'],
            description:
                'Import specifiers that the runtime provides, such as ../../scripts/app.js in a host application. Globs match several.',
            default: [] as [],
        }),
    })
    .optional();

const eslintTableSchema = z.strictObject({
    import_extension: z
        .enum(IMPORT_EXTENSION_STYLES)
        .default('js')
        .meta({
            leftOut: 'repository',
            configurations: ['javascript'],
            description:
                'The import suffix in this scope: js for compiled ESM, ts for Deno and Bun, or extensionless for code that a bundler builds.',
        }),
    restricted_imports: z
        .strictObject({
            name: z.string().meta({
                description: 'The import to refuse.',
            }),
            message: z.string().meta({
                description: 'What to import instead.',
            }),
        })
        .array()
        .default([] as [])
        .meta({
            configurations: ['javascript'],
            description: 'Imports that this repository refuses, each with a name and a message.',
        }),
    rules: eslintRulesSchema.default({}).meta({
        configurations: ['javascript'],
        description:
            'Option arrays by ESLint rule ID, without a severity, for rules that the level runs. gspot refuses options for a rule of level all at a lower level, and ESLint refuses options for a rule that no block turns on. Accept a finding with `gspot ignore javascript/eslint --rule <rule> --reason "<why>"`.',
    }),
    override: z
        .strictObject({
            paths: nonemptyPathsSchema.meta({
                description: 'The files that these lint rule options apply to.',
            }),
            rules: eslintRulesSchema.optional().meta({
                description: 'Lint rule options for these files.',
            }),
            runtime: nonemptyStringSchema.optional().meta({
                description:
                    'The runtime of these files, such as `serviceworker` (the name the `globals` package uses).',
            }),
        })
        .array()
        .default([] as [])
        .meta({
            configurations: ['javascript'],
            description: 'Lint rule options for repository-relative paths, in order, with ignores applied last.',
        }),
    plugins: eslintPluginsSchema,
});

const markdownlintOptionsSchema = z.record(z.string(), z.json());

const markdownlintRulesSchema = buildRuleTableSchema(
    z.record(
        z.string().regex(MARKDOWNLINT_RULE_ID, { error: MARKDOWNLINT_RULE_ID_REFUSAL }),
        markdownlintOptionsSchema,
    ),
    'markdown/markdownlint',
);

const markdownlintSchema = z.strictObject({
    rules: markdownlintRulesSchema.default({}).meta({
        configurations: ['markdown'],
        description:
            'Option tables by Markdown rule ID, such as MD024; the level decides which rules run. Accept a finding with `gspot ignore markdown/markdownlint --rule <rule> --reason "<why>"`.',
    }),
});

const knipSchema = z.strictObject({
    entry: relativePathSchema
        .array()
        .default([] as [])
        .meta({
            configurations: ['javascript'],
            description: 'Entry points knip starts from beyond the ones the framework configuration declares.',
        }),
    ignore_dependencies: allowReasonedValue(
        z.string().min(1).regex(KNIP_PACKAGE_NAME, 'Use an exact package name, without a regular expression.').array(),
        {
            leftOut: 'repository',
            configurations: ['javascript'],
            description:
                'Exact package names that knip does not report as unused; new names need a reason, and a scope list applies to that project only.',
            reason_when: 'adding',
            default: [] as [],
        },
    ),
});

const validationTargetSchema = z.strictObject({
    paths: nonemptyPathsSchema.meta({
        description: 'Files SchemaStore does not know.',
    }),
    url: z.url().meta({
        description: 'The JSON Schema for them.',
    }),
});

export const toolsSchema = z.strictObject({
    hadolint: z
        .strictObject({
            trusted_registries: z
                .string()
                .array()
                .default([] as [])
                .meta({
                    configurations: ['docker'],
                    description: 'The registries a base image may come from; empty allows any.',
                }),
        })
        .optional(),
    nginx: z
        .strictObject({
            image: nonemptyStringSchema
                .default('nginx:1.29.3-alpine@sha256:b3c656d55d7ad751196f21b7fd2e8d4da9cb430e32f646adcf92441b72f82b14')
                .meta({
                    leftOut: 'code',
                    configurations: ['nginx'],
                    description: 'The image nginx -t runs in; name the one the deployment uses.',
                }),
        })
        .optional(),
    ruff: z
        .strictObject({
            docstring_convention: z
                .enum(DOCSTRING_CONVENTIONS)
                .optional()
                .meta({
                    configurations: ['python'],
                    description: 'The docstring style that Ruff and pydoclint check: google, numpy, or pep257.',
                }),
        })
        .optional(),
    semgrep: z
        .strictObject({
            rule_files: relativePathSchema
                .array()
                .default([] as [])
                .meta({
                    configurations: ['security'],
                    description: 'Rule files or folders of the repository that Semgrep runs beside the shipped packs.',
                }),
        })
        .optional(),
    sqlfluff: z
        .strictObject({
            dialect: z
                .enum(SQLFLUFF_DIALECTS)
                .default('ansi')
                .meta({
                    leftOut: 'repository',
                    configurations: ['sql'],
                    description:
                        'The SQL dialect that SQLFluff parses, such as postgres. The postgres configuration sets it.',
                }),
        })
        .optional(),
    swiftlint: z
        .strictObject({
            always_keep_imports: z
                .string()
                .array()
                .default([] as [])
                .meta({
                    leftOut: 'repository',
                    configurations: ['swift'],
                    description: 'Imports the analyzer keeps although it sees no use of them.',
                }),
        })
        .optional(),
    trivy: z
        .strictObject({
            severity: z
                .enum(TRIVY_SEVERITIES)
                .array()
                .default(['HIGH', 'CRITICAL'] as ['HIGH', 'CRITICAL'])
                .meta({
                    configurations: ['docker'],
                    description: 'The severities Trivy reports.',
                }),
        })
        .optional(),
    eslint: eslintTableSchema.optional(),
    commitlint: commitlintSchema,
    markdownlint: markdownlintSchema.optional(),
    stylelint: z
        .strictObject({
            rules: stylelintRulesSchema.default({}).meta({
                configurations: ['css'],
                description:
                    'Options for Stylelint rules, which stay errors. gspot refuses options for a rule of level all at a lower level, and Stylelint reports a rule that it does not know. Accept a finding with `gspot ignore css/stylelint --rule <rule> --reason "<why>"`.',
            }),
        })
        .optional(),
    squawk: z
        .strictObject({
            assume_in_transaction: z
                .boolean()
                .default(true)
                .meta({
                    leftOut: 'repository',
                    configurations: ['postgres'],
                    description: 'Whether the migration runner wraps every migration in a transaction.',
                }),
        })
        .optional(),
    knip: knipSchema.optional(),
    purgecss: z
        .strictObject({
            safelist: allowReasonedValue(nonemptyStringsSchema, {
                leftOut: 'repository',
                configurations: ['site'],
                description: 'Class names a script adds at run time: the names and the reason.',
                reason_when: 'adding',
                default: [] as [],
            }),
        })
        .optional(),
    v8r: z
        .strictObject({
            schema: validationTargetSchema
                .array()
                .default([] as [])
                .meta({
                    configurations: ['data-files'],
                    description:
                        'File patterns mapped to schema URLs, for files that the SchemaStore catalog does not know.',
                }),
        })
        .optional(),
});

for (const [tool, schema] of Object.entries(toolsSchema.shape))
    z.globalRegistry.add(schema, { description: `Options that gspot writes to the ${tool} configuration.` });
