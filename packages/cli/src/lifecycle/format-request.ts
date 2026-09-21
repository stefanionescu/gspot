import { z } from 'zod';
import { policySchema } from '#cli/policy/schema.ts';

const fields = policySchema.shape.format.unwrap().shape;
export const prettierSettings = z.strictObject({
    $schema: z.string().optional(),
    tabWidth: fields.indent_width,
    printWidth: fields.print_width,
    trailingComma: fields.trailing_comma,
    endOfLine: fields.line_ending,
    semi: z.boolean().optional(),
    useTabs: z.boolean().optional(),
    singleQuote: z.boolean().optional(),
    arrowParens: z.enum(['always', 'avoid']).optional(),
    embeddedLanguageFormatting: z.enum(['auto', 'off']).optional(),
});

export const formatRequest = z.strictObject({
    root: z.string().min(1),
    paths: z.array(z.string().min(1)),
    from: z.string().min(1),
    ignorePath: z.string().min(1).optional(),
    source: prettierSettings.optional(),
});
export const prettierIgnoreRequest = formatRequest
    .pick({ root: true, paths: true })
    .extend({ ignorePath: z.string().min(1) });
export const ignoredPathsResponse = z.array(z.string().min(1));
export const formatResponse = z.strictObject({
    ignoredPaths: ignoredPathsResponse,
    format: policySchema.shape.format.unwrap(),
    extra: z
        .strictObject({
            reason: z.string(),
            arrowParens: prettierSettings.shape.arrowParens,
            embeddedLanguageFormatting: prettierSettings.shape.embeddedLanguageFormatting,
        })
        .optional(),
});
