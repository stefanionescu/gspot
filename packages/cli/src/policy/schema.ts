import { z } from 'zod';
import { runnerSchema } from '#cli/policy/runner.ts';
import { hooksSchema } from '#cli/repository/hooks.ts';
import { quoteArgument } from '#cli/platform/arguments.ts';
import { jestCoverageSettings } from '#cli/checks/jest/schema.ts';
import { outputSchema } from '#cli/configurations/output-format.ts';
import { commandSchema, findingExitCodesSchema } from '#cli/configurations/command-schema.ts';
import { INDENT_MAX, PRINT_WIDTH_MAX, PRINT_WIDTH_MIN } from '#cli/constants/policy/policy.ts';

const text = z.string();

const relativeDirectory = text
    .min(1)
    .regex(
        /^(?!\/)(?![\s\S]*(?:^|\/)\.\.(?:\/|$))[^\\:\p{Cc}]+$/u,
        'Use a relative path with forward slashes, without parent traversal or a drive prefix.',
    );

const flag = z.boolean();

const textList = z.array(text);

const textListNonEmpty = z.array(text.min(1)).min(1);

const anyTable = z.record(text, z.unknown());

const reasoned = <T extends z.ZodType>(inner: T) => z.union([inner, z.strictObject({ value: inner, reason: text })]);

const reasonedNumber = reasoned(z.number());

const reasonedTextList = reasoned(textList);

const limitTable = z
    .object({ trivial_statements: reasoned(z.number().int().positive()).optional() })
    .catchall(reasonedNumber);

const limitValue = z.union([reasonedNumber, limitTable]);
const limitsTable = z
    .object({ trivial_statements: reasoned(z.number().int().positive()).optional() })
    .catchall(limitValue);

const namingCategoryShape = {
    max_chars: reasonedNumber.optional(),
    max_words: reasonedNumber.optional(),
    case: reasonedTextList.optional(),
};

const namingCategory = z.strictObject(namingCategoryShape);

const namingLanguage = z.object(namingCategoryShape).catchall(namingCategory);

const namingRule = z.strictObject({
    paths: textListNonEmpty,
    languages: textList.optional(),
    categories: textList.optional(),
    names: textList.optional(),
    structural_prefix: text.optional(),
    allow_digits: flag.optional(),
    allow_duplicate_words: flag.optional(),
    exclude: flag.optional(),
    case: textList.optional(),
    reason: text.optional(),
});

const namedReason = z.strictObject({ name: text, reason: text.optional() });

const reservedTerm = z.strictObject({ term: text, allowed_for: textList });

const groupReason = z.strictObject({ group: text, reason: text.optional() });

const contractProperties = z.strictObject({ file: text, names: textList });

const namingLists = z.object({
    banned_terms: textList.optional(),
    allowed: z.array(namedReason).optional(),
    external: textList.optional(),
    reserved: z.array(reservedTerm).optional(),
    remove_groups: z.array(groupReason).optional(),
    contract_properties: z.array(contractProperties).optional(),
    rules: z.array(namingRule).optional(),
});

const element = z.strictObject({ name: text, paths: textList });

const allowedEdge = z.strictObject({ from: text, to: textList, reason: text.optional() });

const roleGlobs = z.union([text, textList]);

const architectureSchema = z.strictObject({
    types_directory: text.optional(),
    constants_directory: text.optional(),
    elements: z.array(element).optional(),
    edges_allowed: z.array(allowedEdge).optional(),
    roles: z.record(text, roleGlobs).optional(),
    contracts: z.array(anyTable).optional(),
});

const reasonedPaths = z.strictObject({ paths: textListNonEmpty, reason: text.optional() });

const structureSchema = z.strictObject({
    reexports: z.enum(['none', 'index-only']).optional(),
    single_file_folder_allowed: z.array(reasonedPaths).optional(),
    prefix_collision_allowed: z.array(reasonedPaths).optional(),
    folder_name_allowed: z.array(reasonedPaths).optional(),
    python: anyTable.optional(),
});

const formatFields = z.strictObject({
    indent_style: z.enum(['space', 'tab']).optional(),
    indent_width: z.number().int().min(1).max(INDENT_MAX).optional(),
    print_width: z.number().int().min(PRINT_WIDTH_MIN).max(PRINT_WIDTH_MAX).optional(),
    line_ending: z.enum(['lf', 'crlf']).optional(),
    newline_at_end: flag.optional(),
    quotes: z.enum(['single', 'double']).optional(),
    trailing_comma: z.enum(['all', 'es5', 'none']).optional(),
    semicolons: flag.optional(),
});

const formatOverride = formatFields
    .extend({ paths: textListNonEmpty })
    .refine((entry) => Object.keys(entry).length > 1, {
        message: 'A format override needs at least one formatting option.',
    })
    .meta({ minProperties: 2 });
const formatSchema = formatFields.extend({ overrides: z.array(formatOverride).optional() });

const proseSchema = z.strictObject({ vocabulary: textList.optional() });

const extraTable = z.object({ reason: text.optional() }).catchall(z.unknown());

const toolTable = z.object({ extra: extraTable.optional() }).catchall(z.unknown());

const enabledSeverity = z.union([z.literal('warn'), z.literal('error'), z.literal(1), z.literal(2)]);
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
const toolsSchema = z
    .object({
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

const ignoreSchema = z.strictObject({
    check: text,
    rule: text.optional(),
    paths: textList.optional(),
    reason: text.optional(),
});

const generatedSchema = z.strictObject({
    paths: textListNonEmpty,
    produced_by: text.optional(),
    reason: text.optional(),
});

const vendoredSchema = z.strictObject({ paths: textListNonEmpty, reason: text.optional() });

const checkSchema = z
    .strictObject({
        name: text,
        command: commandSchema,
        paths: textListNonEmpty,
        inputs: z
            .array(relativeDirectory)
            .min(1)
            .optional()
            .describe(
                'Root-relative file globs read by the command, including ignored files. Omit to disable caching.',
            ),
        stage: z.enum(['commit', 'push', 'manual']),
        help: text.optional(),
        fix_command: commandSchema.optional(),
        fix_order: z.enum(['codemod', 'imports', 'manifest', 'format']).optional(),
        findings_exit_codes: findingExitCodesSchema
            .optional()
            .describe(
                'Native nonzero statuses that mean source findings. Other nonzero statuses mean execution failure.',
            ),
        fix_findings_exit_codes: findingExitCodesSchema
            .optional()
            .describe(
                'Native nonzero correction exit codes that mean findings remain. Other nonzero codes are execution errors.',
            ),
        count_regex: text.optional(),
        tool_errors: text
            .optional()
            .describe(
                'A multiline Unicode regular expression matching fatal tool diagnostics in stdout or stderr, for both checks and corrections.',
            ),
        requires: z.enum(['build', 'docker', 'network']).optional(),
        platform: z.array(z.enum(['macos', 'linux', 'windows'])).optional(),
        summary: text.optional(),
        output: outputSchema.optional(),
    })
    .refine((check) => check.fix_command === undefined || check.fix_order !== undefined, {
        message: 'A fix_command requires fix_order.',
        path: ['fix_order'],
    })
    .refine((check) => check.fix_findings_exit_codes === undefined || check.fix_command !== undefined, {
        message: 'fix_findings_exit_codes requires fix_command.',
        path: ['fix_findings_exit_codes'],
    })
    .meta({ dependentRequired: { fix_command: ['fix_order'], fix_findings_exit_codes: ['fix_command'] } });

const ciPlatform = z.enum(['ubuntu', 'macos', 'windows']);

const rulesSchema = z.strictObject({
    install: flag.default(true).describe('Install rule files and agent instructions.'),
    directory: relativeDirectory
        .default('.gspot/rules')
        .describe('Repository-relative destination for installed rules.'),
    project: text.optional().describe('Repository-relative project rule layer linked from agent instructions.'),
    exclude: textList.default([]).describe('Rule file patterns excluded from the installed selection.'),
    agents: z
        .array(relativeDirectory)
        .default([])
        .describe(
            'Additional repository-relative agent instruction files; AGENTS.md and detected supported files are included automatically.',
        ),
});

const coverageSchema = z.strictObject({ strict: flag.optional() });

const namingTable = namingLists.catchall(namingLanguage);

const scopeBody = {
    limits: limitsTable.optional(),
    naming: namingTable.optional(),
    architecture: architectureSchema.optional(),
    structure: structureSchema.optional(),
    tools: toolsSchema.optional(),
    format: formatSchema.optional(),
};

/** Primitive value shapes declared by manifest settings, before reason wrappers. */
export const settingValueSchemas = {
    number: z.number(),
    string: z.string(),
    boolean: z.boolean(),
    list: z.array(z.unknown()),
    table: anyTable,
};

export const ciSchema = z.strictObject({
    provider: z.enum(['github', 'gitlab']).describe('The CI provider that receives generated jobs.'),
    platforms: z.array(ciPlatform).min(1).default(['ubuntu']).describe('Platforms for GitHub check and manual jobs.'),
    run: z
        .enum(['changed', 'all'])
        .default('changed')
        .describe('Check changed inputs or the full checked-out tree in CI.'),
    sarif: z.boolean().default(true).describe('Upload SARIF through a separate GitHub code-scanning job.'),
});

/** Integration settings use the same fields, defaults, and descriptions as policy validation. */
export const integrationSettingSchemas = Object.fromEntries(
    Object.entries({ hooks: hooksSchema, ci: ciSchema, runner: runnerSchema, rules: rulesSchema }).flatMap(
        ([section, schema]) =>
            Object.entries(schema.shape as Record<string, z.ZodType>).map(
                ([key, field]) =>
                    [
                        `${section}.${key}`,
                        field.safeParse(undefined).success ? field : field.optional().describe(field.description ?? ''),
                    ] as const,
            ),
    ),
);

/** One [[scope]] entry: its path, configurations, and the per-scope tables. */
export const scopeSchema = z.strictObject({
    path: relativeDirectory,
    configurations: textList.optional(),
    ...scopeBody,
});

/** Root settings exposed by the command and reference owners. */
export const rootSettingSchemas = {
    level: z
        .enum(['recommended', 'all'])
        .default('recommended')
        .describe('Recommended runs defect checks. All also runs style and layout checks.'),
    require_reasons: flag.default(false).describe('Require a reason for ignores and loosened settings.'),
    extra_checks: textList.default([]).describe('Checks at level all to run individually at level recommended.'),
    exclude: textList.default([]).describe('Paths and directory patterns excluded before reading source content.'),
    generated: z.array(generatedSchema).default([]).describe('Generated files excluded from source checks.'),
    vendored: z.array(vendoredSchema).default([]).describe('Upstream files excluded from source checks.'),
};

/** The whole of gspot.toml. */
export const policySchema = z.strictObject({
    version: z.number().int(),
    ...rootSettingSchemas,
    configurations: textList.optional(),
    scope: z.array(scopeSchema).optional(),
    ...scopeBody,
    prose: proseSchema.optional(),
    ignore: z.array(ignoreSchema).optional(),
    check: z.array(checkSchema).optional(),
    hooks: hooksSchema.optional(),
    ci: ciSchema.optional(),
    rules: rulesSchema.optional(),
    coverage: coverageSchema.optional(),
    runner: runnerSchema.optional(),
});
