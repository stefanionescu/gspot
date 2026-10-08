// Output parsing metadata shared by configuration and command checks.
import { z } from 'zod';

export const outputSchema = z.strictObject({
    format: z.union([
        z.literal('regex').meta({
            description:
                'Read findings from lines matched by pattern and its named file, line, column, rule, and message groups.',
        }),
        z.literal('grouped').meta({
            description: 'Read a file heading matched by file_pattern, followed by findings matched by pattern.',
        }),
        z.literal('sarif').meta({ description: 'Read SARIF results, rule metadata, source locations, and fixes.' }),
        z.literal('knip').meta({ description: 'Read Knip JSON issue categories and source positions.' }),
        z
            .literal('semgrep')
            .meta({ description: 'Read Semgrep JSON results, locations, rule IDs, messages, and native fixes.' }),
        z
            .literal('trufflehog-json')
            .meta({ description: 'Read TruffleHog JSON findings while withholding raw secret output.' }),
        z.literal('typos').meta({ description: 'Read typos JSON and convert byte offsets to character columns.' }),
        z
            .literal('markdownlint')
            .meta({ description: 'Read markdownlint result objects and their rule and source locations.' }),
        z
            .literal('json')
            .meta({ description: 'Read JSON findings using items, children, and fields to select report entries.' }),
        z
            .literal('lines')
            .meta({ description: 'Report each nonempty output line as a finding without a source location.' }),
        z.literal('none').meta({ description: 'Use the exit status without parsing output into findings.' }),
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
