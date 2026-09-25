import { z } from 'zod';
import { policySchema } from '#cli/policy/schema.ts';

export const eslintPreviewRequest = z.strictObject({
    root: z.string().min(1),
    path: z.string().min(1),
    sources: z.array(z.string()).min(1).max(2),
});
export const eslintPreviewResponse = z.array(z.record(z.string(), z.json()));

export const eslintRequest = z.strictObject({
    root: z.string().min(1),
    paths: z.array(z.string().min(1)),
    flat: z.boolean(),
    from: z.string().min(1).optional(),
    configs: z.array(z.string().min(1)).optional(),
});
export const eslintResponse = z.strictObject({
    adopted: policySchema.shape.tools.unwrap().shape.eslint.unwrap().shape.adopted.unwrap(),
});

export const eslintCoverageRequest = z.strictObject({
    root: z.string().min(1),
    paths: z.array(z.string().min(1)),
});
export const eslintCoverageResponse = z.record(z.string(), z.array(z.string()));

export const licenseRequest = z.strictObject({
    root: z.string(),
    from: z.string(),
    exclusions: z.array(z.string().min(1)),
});
export const licenseResponse = z.array(z.strictObject({ package: z.string().min(1), license: z.string().min(1) }));

export const stylelintRequest = z.strictObject({
    root: z.string(),
    version: z.string().min(1),
    rules: z.record(z.string(), z.json()),
});

export const stylelintResponse = z.literal(true);

export const stylelintSource = z.strictObject({
    rules: z.record(z.string(), z.json()).optional(),
    extends: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
});

export const formatFields = policySchema.shape.format.unwrap().shape;
export const prettierSettings = z.strictObject({
    $schema: z.string().optional(),
    tabWidth: z.number().int().nonnegative().optional(),
    printWidth: z.number().int().nonnegative().optional(),
    trailingComma: formatFields.trailing_comma,
    endOfLine: z.enum(['lf', 'crlf', 'cr', 'auto']).optional(),
    semi: z.boolean().optional(),
    useTabs: z.boolean().optional(),
    singleQuote: z.boolean().optional(),
    arrowParens: z.enum(['always', 'avoid']).optional(),
    embeddedLanguageFormatting: z.enum(['auto', 'off']).optional(),
    bracketSpacing: z.boolean().optional(),
    bracketSameLine: z.boolean().optional(),
    htmlWhitespaceSensitivity: z.enum(['css', 'strict', 'ignore']).optional(),
    singleAttributePerLine: z.boolean().optional(),
    vueIndentScriptAndStyle: z.boolean().optional(),
    objectWrap: z.enum(['preserve', 'collapse']).optional(),
    experimentalOperatorPosition: z.enum(['start', 'end']).optional(),
    experimentalTernaries: z.boolean().optional(),
    jsxSingleQuote: z.boolean().optional(),
    quoteProps: z.enum(['as-needed', 'consistent', 'preserve']).optional(),
    proseWrap: z.enum(['always', 'never', 'preserve']).optional(),
    checkIgnorePragma: z.boolean().optional(),
    insertPragma: z.boolean().optional(),
    requirePragma: z.boolean().optional(),
    parser: z.string().min(1).optional(),
});
export const prettierSource = prettierSettings.extend({
    overrides: z
        .array(
            z.strictObject({
                files: z.union([z.string(), z.array(z.string())]),
                excludeFiles: z.union([z.string(), z.array(z.string())]).optional(),
                options: prettierSettings,
            }),
        )
        .optional(),
});
export const formatRequest = z.strictObject({
    root: z.string().min(1),
    from: z.string().min(1),
    ignorePaths: z.array(z.string().min(1)).optional(),
    source: prettierSource.optional(),
    nativeDefaults: z.boolean().optional(),
    nested: z.array(z.strictObject({ from: z.string().min(1), source: prettierSource.optional() })).optional(),
});
export const prettierIgnoreRequest = z.strictObject({
    root: z.string().min(1),
    paths: z.array(z.string().min(1)),
    ignorePath: z.string().min(1),
});
export const ignoredPathsResponse = z.array(z.string().min(1));
export const formatResponse = z.strictObject({
    ignorePatterns: z.array(z.string()).optional(),
    format: policySchema.shape.format.unwrap(),
    extra: prettierSettings
        .extend({
            reason: z.string(),
            overrides: formatRequest.shape.source.unwrap().shape.overrides,
        })
        .optional(),
});

export const configurationRequest = z.discriminatedUnion('operation', [
    eslintPreviewRequest.extend({ tool: z.literal('eslint'), operation: z.literal('preview-rules') }),
    stylelintRequest.extend({ tool: z.literal('stylelint'), operation: z.literal('stylelint') }),
    licenseRequest.extend({ tool: z.literal('license-checker-rseidelsohn'), operation: z.literal('licenses') }),
    formatRequest.extend({ tool: z.literal('prettier'), operation: z.literal('format') }),
    eslintRequest.extend({ tool: z.literal('eslint'), operation: z.literal('rules') }),
    eslintCoverageRequest.extend({ tool: z.literal('eslint'), operation: z.literal('coverage') }),
    prettierIgnoreRequest.extend({ tool: z.literal('prettier'), operation: z.literal('ignore') }),
]);
