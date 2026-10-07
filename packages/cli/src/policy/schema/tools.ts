import { z } from 'zod';
import { quoteArgument } from '#cli/platform/text.ts';
import { reasoned } from '#cli/policy/schema/fields.ts';
import { licenseExceptionSchema } from '#cli/parsers/schema/licenses.ts';
import ESLINT_RUNTIMES from '../../../configurations/language/javascript/runtime-names.json' with { type: 'json' };

import {
    YAML_OPTIONS_HELP,
    ESLINT_OPTIONS_HELP,
    ESLINT_OPTION_STRING,
    STYLELINT_OPTIONS_HELP,
    COMMITLINT_OPTIONS_HELP,
    MARKDOWNLINT_OPTIONS_HELP,
} from '#cli/config/policy/settings.ts';

const extraTable = z.object({ reason: z.string().optional() }).catchall(z.unknown());

const toolTable = z.object({ verbatim: extraTable.optional() }).catchall(z.unknown());

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

const eslintTable = toolTable.extend({
    runtimes: z.record(z.string().min(1), z.enum(ESLINT_RUNTIMES)).optional(),
    script_files: z.array(z.string().min(1)).optional(),
    rules: eslintRules.optional(),
    overrides: z.array(z.strictObject({ paths: z.array(z.string().min(1)).min(1), rules: eslintRules })).optional(),
});

export const licenseSettingsSchema = toolTable.extend({
    allowed: z.array(z.string().min(1)).optional(),
    exceptions: z.array(licenseExceptionSchema).optional(),
});

export const toolsSchema = z
    .object({
        eslint: eslintTable.optional(),
        commitlint: z
            .strictObject({
                types: z.array(z.string().min(1)).optional(),
                scopes: z.array(z.string().min(1)).optional(),
                rules: commitlintRules.optional(),
            })
            .optional(),
        yamllint: z.strictObject({ rules: yamlRules.optional() }).optional(),
        lychee: z
            .strictObject({
                exclude: reasoned(z.array(z.unknown())).optional(),
                exclude_urls: reasoned(z.array(z.unknown())).optional(),
            })
            .optional(),
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
        stylelint: toolTable.extend({ rules: stylelintRules.optional() }).optional(),
        squawk: toolTable.extend({ assume_in_transaction: reasoned(z.boolean()).optional() }).optional(),
        jest: toolTable
            .extend({
                coverage: z
                    .strictObject({
                        lines: reasoned(z.number()).optional(),
                        branches: reasoned(z.number()).optional(),
                        functions: reasoned(z.number()).optional(),
                        statements: reasoned(z.number()).optional(),
                    })
                    .optional(),
                globals_module: z.string().min(1).optional(),
            })
            .optional(),
        prettier: toolTable.extend({ exclude: reasoned(z.array(z.string())).optional() }).optional(),
    })
    .catchall(toolTable);
