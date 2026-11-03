import { z } from 'zod';

import {
    STAGES,
    MAX_EXIT_CODE,
    DEFAULT_PATTERN,
    DEFAULT_FILE_PATTERN,
    DEFAULT_OUTPUT_FORMAT,
    DEFAULT_GROUPED_PATTERN,
} from '#cli/config/manifests.ts';

const findingExitCodesSchema = z.int().min(1).max(MAX_EXIT_CODE).array();

export const checkStageSchema = z.enum(STAGES);

export const commandSchema = z
    .string()
    .array()
    .min(1)
    .refine((command) => command[0] !== '', { error: 'The executable cannot be empty.', path: [0] })
    .meta({ prefixItems: [{ type: 'string', minLength: 1 }] });

const outputFieldsSchema = z.strictObject({
    file: z.string().describe('For json: the field that holds the file.').optional(),
    line: z.string().describe('For json: the field that holds the line.').optional(),
    column: z.string().describe('For json: the field that holds the column.').optional(),
    rule: z.string().describe('For json: the field that holds the lint rule.').optional(),
    fingerprint: z
        .string()
        .describe('For json: the field that names this one finding, which the rule of an ignore can name.')
        .optional(),
    message: z
        .union([z.string(), z.string().array()])
        .describe('For json: the field that holds the message, or the fields that join into it.')
        .optional(),
    fixable: z
        .string()
        .describe('For json: the field that is set, and not null, when the tool can fix the finding.')
        .optional(),
});

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
                z.literal('knip').meta({ description: 'Read Knip JSON issue categories and source positions.' }),
                z.literal('semgrep').meta({
                    description: 'Read Semgrep JSON results and source parse errors, with locations and rule IDs.',
                }),
                z
                    .literal('typos')
                    .meta({ description: 'Read typos JSON and convert byte offsets to character columns.' }),
                z.literal('taplo').meta({ description: 'Read Taplo syntax errors and formatting differences.' }),
                z
                    .literal('vale')
                    .meta({ description: 'Read Vale JSON alerts by file, with locations and rule names.' }),
                z.literal('json').meta({
                    description: 'Read JSON findings using list, children, and fields to select report entries.',
                }),
                z.literal('none').meta({ description: 'Use the exit status without parsing output into findings.' }),
            ])
            .describe('How gspot reads the output: json, regex, grouped, none, or the format of a named tool.'),
        list: z.string().describe('For json: the path to the list of findings.').optional(),
        children: z
            .string()
            .array()
            .describe(
                'For json: the fields that lead from each item to its findings, one list per field. A finding without a field takes it from its parents.',
            )
            .optional(),
        line_base: z
            .union([z.literal(0), z.literal(1)])
            .describe('Whether the tool counts lines from 0 or 1.')
            .optional(),
        fields: outputFieldsSchema
            .optional()
            .describe('For json: the report fields that supply each finding property.'),
        pattern: z
            .string()
            .describe(
                'For regex: the pattern for one finding, with named groups file, line, column, rule, and message.',
            )
            .optional(),
        file_pattern: z
            .string()
            .describe('For grouped: the pattern for a line that names the file of the findings below it.')
            .optional(),
        fixable: z.string().describe('For regex: the pattern that marks a fixable finding.').optional(),
        message: z
            .string()
            .describe('For regex: the message of every finding whose pattern has no message group.')
            .optional(),
    })
    .transform((output) => {
        switch (output.format) {
            case 'regex': {
                return { ...output, format: 'regex' as const, pattern: output.pattern ?? DEFAULT_PATTERN };
            }
            case 'grouped': {
                return {
                    ...output,
                    format: 'grouped' as const,
                    pattern: output.pattern ?? DEFAULT_GROUPED_PATTERN,
                    file_pattern: output.file_pattern ?? DEFAULT_FILE_PATTERN,
                };
            }
            default: {
                return { ...output, format: output.format };
            }
        }
    });

export const commandCheckFields = {
    command: commandSchema.optional(),
    stage: checkStageSchema,
    summary: z.string().optional(),
    help: z.string().optional(),
    fix: commandSchema.optional(),
    fix_extensions: z.string().min(1).array().optional(),
    exit_codes: findingExitCodesSchema.optional(),
    output: outputSchema.default(DEFAULT_OUTPUT_FORMAT),
};
