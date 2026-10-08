// Output parsing metadata shared by configuration and command checks.
import { z } from 'zod';

export const outputSchema = z.strictObject({
    format: z.enum([
        'regex',
        'grouped',
        'sarif',
        'knip',
        'semgrep',
        'trufflehog-json',
        'typos',
        'markdownlint',
        'json',
        'lines',
        'none',
    ]),
    items: z.string().optional(),
    children: z.string().optional(),
    line_base: z.union([z.literal(0), z.literal(1)]).optional(),
    // Paths in the repository, link targets, and paths in past commits have different existence requirements.
    file_type: z.enum(['path', 'link', 'history']).optional(),
    fields: z
        .strictObject({
            file: z.string().optional(),
            line: z.string().optional(),
            column: z.string().optional(),
            rule: z.string().optional(),
            message: z.string().optional(),
            fixable: z.string().optional(),
        })
        .optional(),
    pattern: z.string().optional(),
    file_pattern: z.string().optional(),
    fixable: z.string().optional(),
    message: z.string().optional(),
});
