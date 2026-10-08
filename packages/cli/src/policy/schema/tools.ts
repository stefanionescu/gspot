import { z } from 'zod';
import { quoteArgument } from '#cli/platform/contracts.ts';
import { relativePath } from '#cli/policy/schema/contracts.ts';
import ESLINT_RUNTIMES from '../../../configurations/language/javascript/runtime-names.json' with { type: 'json' };

import {
    YAML_OPTIONS_HELP,
    ESLINT_OPTIONS_HELP,
    ESLINT_OPTION_STRING,
    STYLELINT_OPTIONS_HELP,
    COMMITLINT_OPTIONS_HELP,
    MARKDOWNLINT_OPTIONS_HELP,
} from '#cli/config/policy/settings.ts';

const extraTable = z.record(z.string(), z.unknown()).meta({
    description:
        'Native options gspot does not declare, only for ESLint, Prettier, EditorConfig, typos, ShellCheck, knip, and Taplo.',
});

// Only tools whose writers read the options accept a verbatim table.
const toolOptionsSchema = z.strictObject({ verbatim: extraTable.optional() });

const firstEslintOption = z.union([
    z.string().regex(ESLINT_OPTION_STRING, { error: ESLINT_OPTIONS_HELP }),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.json()),
    z.record(z.string(), z.json()),
]);

const eslintOptions = z.union([z.array(z.never()).max(0), z.tuple([firstEslintOption]).rest(z.json())], {
    error: ESLINT_OPTIONS_HELP,
});

const eslintRules = z.record(z.string(), eslintOptions);

// Nested native options retain the rule key before any option name or tuple index.
function nativeDiagnostic(issue: z.core.$ZodRawIssue, help: string): string {
    const path = issue.path ?? [];
    const rule = path[path.indexOf('rules') + 1];
    return help.replace('<rule>', quoteArgument(String(rule)));
}

const commitlintRules = z.record(
    z.string().min(1),
    z.tuple(
        [
            z.enum(['always', 'never'], { error: (issue) => nativeDiagnostic(issue, COMMITLINT_OPTIONS_HELP) }),
            z.json().optional(),
        ],
        {
            error: (issue) => nativeDiagnostic(issue, COMMITLINT_OPTIONS_HELP),
        },
    ),
);

const yamlOptions = z
    .object(
        {
            level: z.literal('error', { error: (issue) => nativeDiagnostic(issue, YAML_OPTIONS_HELP) }).optional(),
            ignore: z.never({ error: (issue) => nativeDiagnostic(issue, YAML_OPTIONS_HELP) }).optional(),
            'ignore-from-file': z.never({ error: (issue) => nativeDiagnostic(issue, YAML_OPTIONS_HELP) }).optional(),
        },
        { error: (issue) => nativeDiagnostic(issue, YAML_OPTIONS_HELP) },
    )
    .catchall(z.json());

const yamlRules = z
    .object({
        indentation: yamlOptions
            .extend({
                spaces: z
                    .literal('consistent', { error: (issue) => nativeDiagnostic(issue, YAML_OPTIONS_HELP) })
                    .optional(),
            })
            .optional(),
    })
    .catchall(yamlOptions);

const stylelintOptions = z
    .object({ severity: z.literal('error', { error: STYLELINT_OPTIONS_HELP }).optional() })
    .catchall(z.json());

const stylelintValue = z.union([z.literal(true), z.string().min(1), z.number(), stylelintOptions]);

const stylelintRules = z.record(
    z.string().min(1),
    z.union([stylelintValue, z.tuple([z.union([stylelintValue, z.array(z.json())]), stylelintOptions.optional()])], {
        error: STYLELINT_OPTIONS_HELP,
    }),
);

const eslintTable = toolOptionsSchema.extend({
    import_extensions: z.record(relativePath, z.enum(['js', 'ts', 'extensionless'])).optional(),
    runtimes: z.record(relativePath, z.enum(ESLINT_RUNTIMES)).optional(),
    rules: eslintRules.optional(),
    overrides: z.array(z.strictObject({ paths: z.array(relativePath).min(1), rules: eslintRules })).optional(),
});

export const toolsSchema = z.object({
    eslint: eslintTable.optional(),
    commitlint: z
        .strictObject({
            types: z.array(z.string().min(1)).optional(),
            scopes: z.array(z.string().min(1)).optional(),
            rules: commitlintRules.optional(),
        })
        .optional(),
    yamllint: z.strictObject({ rules: yamlRules.optional() }).optional(),
    lychee: z.strictObject({}).optional(),
    markdownlint: z
        .strictObject({
            rules: z
                .record(
                    z.string().regex(/^MD\d{3}$/u, { error: MARKDOWNLINT_OPTIONS_HELP }),
                    z.record(z.string(), z.json(), { error: MARKDOWNLINT_OPTIONS_HELP }),
                    { error: MARKDOWNLINT_OPTIONS_HELP },
                )
                .optional(),
        })
        .optional(),
    stylelint: z.strictObject({ rules: stylelintRules.optional() }).optional(),
    squawk: z.strictObject({ assume_in_transaction: z.boolean().optional() }).optional(),
    prettier: toolOptionsSchema.optional(),
    editorconfig: toolOptionsSchema.optional(),
    typos: toolOptionsSchema.optional(),
    shellcheck: toolOptionsSchema.optional(),
    knip: toolOptionsSchema
        .extend({
            ignore_dependencies: z
                .record(
                    z.string().min(1),
                    z.union([z.string(), z.strictObject({ workspace: relativePath, reason: z.string() })]),
                )
                .optional(),
        })
        .optional(),
    purgecss: z.strictObject({ safelist: z.record(z.string().min(1), z.string()).optional() }).optional(),
    v8r: z.strictObject({ schemas: z.record(relativePath, z.url()).optional() }).optional(),
    taplo: toolOptionsSchema.optional(),
});
