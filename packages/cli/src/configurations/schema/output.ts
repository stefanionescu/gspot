// Validates how a check declares the output format of its tool.
import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { OutputSpec, OutputInput } from '#cli/types/runs/output.ts';

import {
    DEFAULT_PATTERN,
    OUTPUT_FILE_TYPES,
    DEFAULT_FILE_PATTERN,
    DEFAULT_GROUPED_PATTERN,
} from '#cli/config/runs/output.ts';

export const outputSchema = z
    .strictObject({
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
            z.literal('semgrep').meta({
                description: 'Read Semgrep JSON results, locations, rule IDs, messages, and fixes provided by Semgrep.',
            }),
            z
                .literal('trufflehog')
                .meta({ description: 'Read TruffleHog JSON findings while withholding raw secret output.' }),
            z.literal('typos').meta({ description: 'Read typos JSON and convert byte offsets to character columns.' }),
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
        ]) satisfies z.ZodType<OutputInput['format']>,
        items: z.string().optional(),
        children: z.string().optional(),
        line_base: (
            z.union([z.literal(0), z.literal(1)]) satisfies z.ZodType<NonNullable<OutputInput['line_base']>>
        ).optional(),
        // Paths in the repository, link targets, and paths in past commits have different existence requirements.
        file_type: z.enum(OUTPUT_FILE_TYPES).default('path'),
        fields: z
            .strictObject({
                file: z.string().optional(),
                line: z.string().optional(),
                column: z.string().optional(),
                rule: z.string().optional(),
                message: z.string().optional(),
                fixable: z.string().optional(),
            } satisfies SchemaShape<NonNullable<OutputSpec['fields']>>)
            .optional(),
        pattern: z.string().optional(),
        file_pattern: z.string().optional(),
        fixable: z.string().optional(),
        message: z.string().optional(),
    } satisfies SchemaShape<OutputInput & Pick<OutputSpec, 'file_type'>>)
    .transform((output): OutputSpec => {
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
    }) satisfies z.ZodType<OutputSpec, OutputInput>;
