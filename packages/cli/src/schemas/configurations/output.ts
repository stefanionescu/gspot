// Validates how a check declares the output format of its tool.
import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { CheckOutput, WrittenOutput } from '#cli/types/runs/output.ts';
import { DEFAULT_PATTERN, DEFAULT_FILE_PATTERN, DEFAULT_GROUPED_PATTERN } from '#cli/config/runs/output.ts';

export const outputSchema = z
    .strictObject({
        format: z
            .union([
                z.literal('regex').meta({
                    description:
                        'Read findings from lines matched by pattern and its named file, line, column, rule, and message groups.',
                }),
                z.literal('grouped').meta({
                    description:
                        'Read a file heading matched by file_pattern, followed by findings matched by pattern.',
                }),
                z
                    .literal('sarif')
                    .meta({ description: 'Read SARIF results, rule metadata, source locations, and fixes.' }),
                z.literal('knip').meta({ description: 'Read Knip JSON issue categories and source positions.' }),
                z.literal('semgrep').meta({
                    description:
                        'Read Semgrep JSON results, locations, rule IDs, messages, and fixes provided by Semgrep.',
                }),
                z
                    .literal('typos')
                    .meta({ description: 'Read typos JSON and convert byte offsets to character columns.' }),
                z
                    .literal('markdownlint')
                    .meta({ description: 'Read markdownlint result objects and their rule and source locations.' }),
                z.literal('json').meta({
                    description: 'Read JSON findings using items, children, and fields to select report entries.',
                }),
                z
                    .literal('lines')
                    .meta({ description: 'Report each nonempty output line as a finding without a source location.' }),
                z.literal('none').meta({ description: 'Use the exit status without parsing output into findings.' }),
            ])
            .describe(
                'How gspot reads the output: json, regex, grouped, lines, none, or the format of a named tool.',
            ) satisfies z.ZodType<WrittenOutput['format']>,
        items: z.string().describe('For json: the path to the list of findings.').optional(),
        children: z.string().describe('For json: the field of each item that holds its findings.').optional(),
        line_base: (
            z
                .union([z.literal(0), z.literal(1)])
                .describe('Whether the tool counts lines from 0 or 1.') satisfies z.ZodType<
                NonNullable<WrittenOutput['line_base']>
            >
        ).optional(),
        fields: z
            .strictObject({
                file: z.string().describe('For json: the field that holds the file.').optional(),
                line: z.string().describe('For json: the field that holds the line.').optional(),
                column: z.string().describe('For json: the field that holds the column.').optional(),
                rule: z.string().describe('For json: the field that holds the lint rule.').optional(),
                message: z.string().describe('For json: the field that holds the message.').optional(),
                fixable: z
                    .string()
                    .describe('For json: the field that is set when the tool can fix the finding.')
                    .optional(),
            } satisfies SchemaShape<NonNullable<CheckOutput['fields']>>)
            .optional(),
        pattern: z
            .string()
            .describe(
                'For regex: the pattern for one finding, with named groups file, line, column, rule, and message.',
            )
            .optional(),
        file_pattern: z
            .string()
            .describe('For regex: the pattern for a line that names the file of the findings below it.')
            .optional(),
        fixable: z.string().describe('For regex: the pattern that marks a fixable finding.').optional(),
        message: z.string().describe('For regex: the pattern for the message.').optional(),
    })
    .transform((output): CheckOutput => {
        switch (output.format) {
            case 'regex': {
                return { ...output, format: 'regex', pattern: output.pattern ?? DEFAULT_PATTERN };
            }
            case 'grouped': {
                return {
                    ...output,
                    format: 'grouped',
                    pattern: output.pattern ?? DEFAULT_GROUPED_PATTERN,
                    file_pattern: output.file_pattern ?? DEFAULT_FILE_PATTERN,
                };
            }
            default: {
                return { ...output, format: output.format };
            }
        }
    }) satisfies z.ZodType<CheckOutput, WrittenOutput>;
