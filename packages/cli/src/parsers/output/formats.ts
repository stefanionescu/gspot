// Defines tool-output formats and validates their declarations.
import { z } from 'zod';
import { realpathSync } from 'node:fs';
import { posix, isAbsolute } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { stripVTControlCharacters } from 'node:util';
import type { SchemaShape } from '#cli/types/objects.ts';
import { DRIVE_LETTER } from '#cli/config/system/paths.ts';
import type { Finding } from '#cli/types/execution/check.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These hoisted readers call the shared report parser in this module; the required format table owns their dispatch.
import { parseJsonFindings } from '#cli/parsers/output/json.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These hoisted readers call the shared report parser in this module; the required format table owns their dispatch.
import { parseKnipFindings } from '#cli/parsers/output/knip.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These hoisted readers call the shared report parser in this module; the required format table owns their dispatch.
import { parseSarifFindings } from '#cli/parsers/output/sarif.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These hoisted readers call the shared report parser in this module; the required format table owns their dispatch.
import { parseTyposFindings } from '#cli/parsers/output/typos.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These hoisted readers call the shared report parser in this module; the required format table owns their dispatch.
import { parseSemgrepFindings } from '#cli/parsers/output/semgrep.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These hoisted readers call the shared report parser in this module; the required format table owns their dispatch.
import { parseTrufflehogFindings } from '#cli/parsers/output/trufflehog.ts';
import { convertToPosixPath, normalizeOutputPath } from '#cli/system/paths.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These hoisted readers call the shared report parser in this module; the required format table owns their dispatch.
import { parseMarkdownlintFindings } from '#cli/parsers/output/markdownlint.ts';
import { parseRegexFindings, parseGroupedFindings } from '#cli/parsers/output/text.ts';

import type {
    OutputSpec,
    OutputPaths,
    OutputInput,
    ParsingCheck,
    OutputDescriptor,
} from '#cli/types/parsers/output.ts';
import {
    FILE_GROUP,
    DEFAULT_PATTERN,
    OUTPUT_FILE_TYPES,
    MISSING_PATH_CODES,
    DEFAULT_FILE_PATTERN,
    DEFAULT_GROUPED_PATTERN,
} from '#cli/config/parsers/output.ts';

function stripRoot(root: string, file: string): string {
    const prefix = `${root}/`;
    if (file.startsWith(prefix)) return file.slice(prefix.length);
    if (!isAbsolute(file)) return file;
    try {
        // The call gives Windows paths one drive letter case and their long folder names.
        const realRoot = `${convertToPosixPath(realpathSync.native(root))}/`;
        const realFile = convertToPosixPath(realpathSync.native(file));
        return realFile.startsWith(realRoot) ? realFile.slice(realRoot.length) : file;
    } catch (error) {
        if (MISSING_PATH_CODES.has((error as NodeJS.ErrnoException).code ?? '')) return file;
        throw error;
    }
}

function hasFilePaths(output: OutputSpec): boolean {
    return (
        output.file_type === 'path' &&
        (output.pattern === undefined ? output.fields?.file !== undefined : output.pattern.includes(FILE_GROUP))
    );
}

/**
 * Parse and validate a report without exposing its untrusted contents in errors.
 * @param tool the tool that produced the invalid output.
 * @param text the JSON report.
 * @param schema the report's contract.
 * @returns the validated report.
 */
export function parseReport<Value>(tool: string, text: string, schema: z.ZodType<Value>): Value {
    try {
        return schema.parse(JSON.parse(text));
    } catch {
        throw new GspotError('output', `${tool} returned invalid structured findings.`);
    }
}

/** The reader and process-result rules for every supported output format. */
export const outputFormats = {
    none: { read: () => [], namesFiles: () => false, redactsOutput: false },
    json: {
        read: parseJsonFindings,
        namesFiles: (output) => output.file_type === 'path' && output.fields?.file !== undefined,
        redactsOutput: false,
    },
    sarif: { read: parseSarifFindings, namesFiles: () => true, redactsOutput: false },
    trufflehog: { read: parseTrufflehogFindings, namesFiles: () => false, redactsOutput: true },
    typos: { read: parseTyposFindings, namesFiles: () => true, redactsOutput: false },
    markdownlint: { read: parseMarkdownlintFindings, namesFiles: () => true, redactsOutput: false },
    knip: { read: parseKnipFindings, namesFiles: () => true, redactsOutput: false },
    semgrep: { read: parseSemgrepFindings, namesFiles: () => true, redactsOutput: false },
    lines: {
        read: ({ check, text, help }) =>
            text
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line !== '')
                .map((line) => ({ check, file: '', message: line, help, fixable: false })),
        namesFiles: () => false,
        redactsOutput: false,
    },
    regex: { read: parseRegexFindings, namesFiles: hasFilePaths, redactsOutput: false },
    grouped: { read: parseGroupedFindings, namesFiles: hasFilePaths, redactsOutput: false },
} satisfies Record<OutputSpec['format'], OutputDescriptor>;

/**
 * The findings a tool's output holds, with every path relative to the root.
 * @param check the check.
 * @param stdout the tool's standard output.
 * @param stderr the tool's standard error.
 * @param paths the repository root and tool working directory, for resolving reported source paths.
 * @returns the findings.
 */
export function parseOutput(check: ParsingCheck, stdout: string, stderr: string, paths: OutputPaths): Finding[] {
    const { root, cwd } = paths;
    const nativeRoot = isAbsolute(root) ? convertToPosixPath(root) : normalizeOutputPath(root);
    const output = check.output;
    // A tool that colors its output although nothing reads colors still yields clean paths and messages.
    const text = stripVTControlCharacters(`${stdout}\n${stderr}`);
    const findings = outputFormats[output.format].read({
        check: check.name,
        help: check.help,
        output,
        stdout,
        text,
        root,
        cwd,
    });
    return findings.map((finding) => {
        const formatted = { ...finding, fixable: check.fix !== undefined && finding.fixable };
        if (output.file_type !== 'path' || finding.file === '') return formatted;
        const file = normalizeOutputPath(finding.file);
        const absolute =
            isAbsolute(file) || DRIVE_LETTER.test(file) ? file : posix.join(normalizeOutputPath(cwd), file);
        formatted.file = stripRoot(nativeRoot, absolute);
        return formatted;
    });
}

// Output parsing metadata shared by configuration and command checks.

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
