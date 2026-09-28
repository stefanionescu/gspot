import { z } from 'zod';
import { quoteArgument } from '#cli/platform/arguments.ts';
import { jestCoverageSettings } from '#cli/checks/jest/schema.ts';
import { reasoned, relativeDirectory } from '#cli/policy/fields.ts';
import { ESLINT_WARN, ESLINT_ERROR } from '#cli/config/evaluation.ts';

const text = z.string();
const flag = z.boolean();
const textList = z.array(text);
const textListNonEmpty = z.array(text.min(1)).min(1);

const extraTable = z.object({ reason: text.optional() }).catchall(z.unknown());

const toolTable = z.object({ extra: extraTable.optional() }).catchall(z.unknown());

const enabledSeverity = z.union([
    z.literal('warn'),
    z.literal('error'),
    z.literal(ESLINT_WARN),
    z.literal(ESLINT_ERROR),
]);
const enabledRule = z.union([enabledSeverity, z.tuple([enabledSeverity]).rest(z.unknown())], {
    error: (issue) =>
        `Use an enabled severity (error, warn, 2, or 1), optionally followed by rule options. To disable this rule, use gspot ignore <check> --rule ${quoteArgument(String(issue.path?.at(-1) ?? '<rule>'))}.`,
});
const eslintRules = z.record(text, enabledRule);
const stylelintValue = z.union([z.literal(true), text.min(1), z.number(), z.record(text, z.json())]);
const stylelintRules = z.record(
    text.min(1),
    z.union([stylelintValue, z.tuple([z.union([stylelintValue, z.array(z.json())])]).rest(z.json())]),
);
const adoptedSeverity = z.union([enabledSeverity, z.literal('off'), z.literal(0)]);
const adoptedRule = z.union([adoptedSeverity, z.tuple([adoptedSeverity]).rest(z.json())]);
const eslintRegistration = z.strictObject({
    module: text.min(1),
    export: text.min(1),
    members: textListNonEmpty.optional(),
});
const eslintCriteria = z.strictObject({
    basePath: relativeDirectory,
    patterns: z.array(z.strictObject({ includes: textList.optional(), excludes: textList.optional() })),
});
const eslintIgnorePattern = z.strictObject({
    basePath: relativeDirectory,
    patterns: textList,
    loose: flag,
    criteria: eslintCriteria.optional(),
});
const eslintTable = toolTable.extend({
    adopted: z
        .array(
            z.strictObject({
                name: text.optional(),
                basePath: relativeDirectory.optional(),
                legacyCriteria: eslintCriteria.optional(),
                legacyScope: eslintCriteria.optional(),
                legacyIgnores: z.array(eslintIgnorePattern).optional(),
                processor: z.union([text.min(1), eslintRegistration]).optional(),
                files: z.array(z.union([text, textListNonEmpty])).optional(),
                ignores: textList.optional(),
                rules: z.record(text, adoptedRule).optional(),
                plugins: z.record(text, eslintRegistration).optional(),
                languageOptions: z.object({ parser: eslintRegistration.optional() }).catchall(z.json()).optional(),
                linterOptions: z.record(text, z.json()).optional(),
                settings: z.record(text, z.json()).optional(),
            }),
        )
        .optional(),
    rules: eslintRules.optional(),
    overrides: z.array(z.strictObject({ paths: textListNonEmpty, rules: eslintRules })).optional(),
});
const editorconfigDocument = z.strictObject({
    preamble: z.record(z.string().regex(/^[\w.-]+$/u), z.string().regex(/^[^\r\n]*$/u)),
    sections: z.array(
        z.strictObject({
            glob: z
                .string()
                .min(1)
                .regex(/^[^\r\n]+$/u),
            properties: z.record(z.string().regex(/^[\w.-]+$/u), z.string().regex(/^[^\r\n]*$/u)),
        }),
    ),
});
export const toolsSchema = z
    .object({
        ruff: toolTable.extend({ docstring_convention: z.enum(['google', 'numpy', 'pep257']).optional() }).optional(),
        eslint: eslintTable.optional(),
        stylelint: toolTable.extend({ rules: stylelintRules.optional() }).optional(),
        squawk: toolTable.extend({ assume_in_transaction: reasoned(flag).optional() }).optional(),
        licenses: toolTable
            .extend({
                licenses_allowed: z.array(text.min(1)).optional(),
                packages_allowed: z
                    .array(
                        z.strictObject({
                            package: text.regex(
                                /^(?:@[^/@\s]+\/[^/@\s]+|[^/@\s]+)@\d[^\s@<>=~^*|,]*$/u,
                                'Name a package and its exact version.',
                            ),
                            license: text.min(1),
                            reason: text.min(1),
                        }),
                    )
                    .optional(),
            })
            .optional(),
        typos: toolTable
            .extend({ locale: reasoned(z.enum(['en', 'en-us', 'en-gb', 'en-ca', 'en-au'])).optional() })
            .optional(),
        sqlfluff: toolTable
            .extend({
                dialect: reasoned(
                    text.regex(
                        /^[a-z][a-z0-9_]*(?![\s\S])/u,
                        'Use a SQLFluff dialect label, such as postgres or sqlite.',
                    ),
                ).optional(),
            })
            .optional(),
        xctest: toolTable
            .extend({
                reference_layout: text
                    .regex(
                        /^(?!\/|\.\.?(?:\/|$))(?!.*\/\.\.?(?:\/|$))/u,
                        'Use a relative snapshot layout without . or .. segments.',
                    )
                    .regex(
                        /^[^{}\\\r\n]*(?:\{file\}[^{}\\\r\n]*\{test\}|\{test\}[^{}\\\r\n]*\{file\})[^{}\\\r\n]*$/u,
                        'Use a relative snapshot layout containing {file} and {test} exactly once each.',
                    )
                    .optional(),
            })
            .optional(),
        jest: toolTable
            .extend({
                coverage_lines: reasoned(jestCoverageSettings.shape.coverage_lines).optional(),
                coverage_branches: reasoned(jestCoverageSettings.shape.coverage_branches).optional(),
                coverage_functions: reasoned(jestCoverageSettings.shape.coverage_functions).optional(),
                coverage_statements: reasoned(jestCoverageSettings.shape.coverage_statements).optional(),
                global_package: text.min(1).optional(),
                harness_directory: relativeDirectory.optional(),
            })
            .optional(),
        prettier: toolTable
            .extend({ ignore_patterns: z.array(z.string()).optional(), native_defaults: z.boolean().optional() })
            .optional(),
        editorconfig: toolTable
            .extend({
                adopted: editorconfigDocument
                    .extend({
                        directories: z.array(editorconfigDocument.extend({ basePath: relativeDirectory })).optional(),
                    })
                    .optional(),
            })
            .optional(),
    })
    .catchall(toolTable);
