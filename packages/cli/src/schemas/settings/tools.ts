import { z } from 'zod';

import {
    IMPORT_EXTENSION_STYLES,
    KNIP_PACKAGE_NAME,
    MARKDOWNLINT_RULE_ID,
    MARKDOWNLINT_RULE_ID_REFUSAL,
    RUFF_SELECTOR,
    SQLFLUFF_DIALECTS,
    TRIVY_SEVERITIES,
} from '#cli/config/settings/schema.ts';
import { nonemptyStringSchema } from '#cli/schemas/manifests/fields.ts';
import { allowReasonedValue, nonemptyPathsSchema, relativePathSchema } from '#cli/schemas/settings/fields.ts';
import {
    buildRuleTableSchema,
    commitlintSchema,
    eslintPluginsSchema,
    eslintRulesSchema,
    stylelintPluginsSchema,
    stylelintRulesSchema,
} from '#cli/schemas/settings/rules.ts';

export const javascriptSchema = z
    .strictObject({
        script_files: allowReasonedValue(relativePathSchema.array(), {
            reason_for: 'adding',
            configurations: ['javascript'],
            description: 'The files that may print to the console and call `process.exit`.',
            default: ['scripts/**', '**/*.config.{js,mjs,cjs,ts}'],
        }),
        import_boundaries: relativePathSchema
            .array()
            .default([])
            .meta({
                configurations: ['javascript'],
                description:
                    'Folders that a relative import may not leave, such as src/features/*. An import of a file outside them takes the alias, and eslint --fix writes it.',
            }),
        externals: allowReasonedValue(z.string().min(1).array(), {
            reason_for: 'adding',
            leftOut: 'repository',
            configurations: ['javascript'],
            description:
                'Import specifiers that the runtime provides, such as ../../scripts/app.js in a host application. Globs match several.',
            default: [],
        }),
        import_extension: z
            .enum(IMPORT_EXTENSION_STYLES)
            .default('js')
            .meta({
                leftOut: 'repository',
                configurations: ['javascript'],
                description:
                    'The import suffix in this scope: js for compiled ESM, ts for Deno and Bun, or extensionless for code that a bundler builds.',
            }),
        banned_imports: z
            .strictObject({
                name: z.string().meta({
                    description: 'The import to refuse.',
                }),
                message: z.string().meta({
                    description: 'What to import instead.',
                }),
            })
            .array()
            .default([])
            .meta({
                configurations: ['javascript'],
                description: 'Imports that this repository refuses, each with a name and a message.',
            }),
        entry_files: relativePathSchema
            .array()
            .default([])
            .meta({
                configurations: ['javascript'],
                description: 'Entry points knip starts from beyond the ones the framework configuration declares.',
            }),
        allowed_unused_dependencies: allowReasonedValue(
            z
                .string()
                .min(1)
                .regex(KNIP_PACKAGE_NAME, 'Use an exact package name, without a regular expression.')
                .array(),
            {
                leftOut: 'repository',
                configurations: ['javascript'],
                description:
                    'Exact package names that knip does not report as unused; new names need a reason, and a scope list applies to that project only.',
                reason_for: 'adding',
                default: [],
            },
        ),
    })
    .optional();

const eslintTableSchema = z.strictObject({
    rules: eslintRulesSchema.default({}).meta({
        configurations: ['javascript'],
        description:
            'Option arrays by ESLint rule ID, without a severity, for rules that the level runs. gspot refuses options for any other rule. Ignore a finding with `gspot ignore javascript/eslint --rule <rule> --reason "<why>"`.',
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
        .default([])
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
            'Option tables by Markdown rule ID, such as MD024; the level decides which rules run. Ignore a finding with `gspot ignore markdown/markdownlint --rule <rule> --reason "<why>"`.',
    }),
});

const validationTargetSchema = z.strictObject({
    paths: nonemptyPathsSchema.meta({
        description: 'Files SchemaStore does not know.',
    }),
    url: z.url().meta({
        description: 'The JSON Schema for them.',
    }),
});

export const toolConfigurationSchemas = {
    docker: z
        .strictObject({
            allowed_registries: z
                .string()
                .array()
                .default([])
                .meta({
                    configurations: ['docker'],
                    description: 'The registries a base image may come from; empty allows any.',
                }),
            severity: z
                .enum(TRIVY_SEVERITIES)
                .array()
                .default(['HIGH', 'CRITICAL'])
                .meta({
                    configurations: ['docker'],
                    description: 'The severities Trivy reports.',
                }),
        })
        .optional(),
    json: z
        .strictObject({
            schemas: validationTargetSchema
                .array()
                .default([])
                .meta({
                    configurations: ['json'],
                    description:
                        'File patterns mapped to schema URLs, for files that the SchemaStore catalog does not know.',
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
    security: z
        .strictObject({
            semgrep_rules: relativePathSchema
                .array()
                .default([])
                .meta({
                    configurations: ['security'],
                    description:
                        'Rule files or folders of the repository that Semgrep runs, along with the rules of the FastAPI configuration.',
                }),
        })
        .optional(),
    sql: z
        .strictObject({
            dialect: z
                .enum(SQLFLUFF_DIALECTS)
                .default('ansi')
                .meta({
                    leftOut: 'repository',
                    configurations: ['sql'],
                    description:
                        'The SQL dialect that SQLFluff parses, such as postgres. The postgres configuration sets it. A `[[scope]]` sets another dialect for its folder.',
                }),
        })
        .optional(),
};

const ruffSchema = z.strictObject({
    rules: z
        .string()
        .regex(RUFF_SELECTOR, 'Use a Ruff rule code or prefix, such as ANN or E501.')
        .array()
        .default([])
        .meta({
            configurations: ['python'],
            description:
                'Ruff rules or rule prefixes to run on top of the rules of the level, such as ANN. Ignore a finding with `gspot ignore python/ruff --rule <rule> --reason "<why>"`.',
        }),
});

function describeToolTables<Tables extends Record<string, z.ZodType>>(tables: Tables): Tables {
    for (const [tool, schema] of Object.entries(tables))
        z.globalRegistry.add(schema, { description: `Options that gspot writes to the ${tool} configuration.` });
    return tables;
}

const toolTables = {
    eslint: eslintTableSchema.optional(),
    ruff: ruffSchema.optional(),
    commitlint: commitlintSchema,
    markdownlint: markdownlintSchema.optional(),
    stylelint: z
        .strictObject({
            rules: stylelintRulesSchema.default({}).meta({
                configurations: ['css'],
                description:
                    'Options for Stylelint rules, which stay errors. gspot refuses options for a rule of level all at a lower level, and Stylelint reports a rule that it does not know. Ignore a finding with `gspot ignore css/stylelint --rule <rule> --reason "<why>"`.',
            }),
            plugins: stylelintPluginsSchema,
        })
        .optional(),
};

export const toolsSchema = z.strictObject(describeToolTables(toolTables));
