// Findings from validated structured reports produced by named tools.
import { resolve, relative } from 'node:path';
import { codePoints } from '#cli/platform/text.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { readSource } from '#cli/platform/source.ts';
import { LINE_FEED } from '#cli/config/parsers/source.ts';
import { toPosix, toolPath } from '#cli/platform/paths.ts';
import type { Finding } from '#cli/types/execution/runtime.ts';
import type { TypoEntry, EslintReport, EslintDiagnostic, MarkdownlintEntry } from '#cli/types/parsers/output.ts';

import {
    typosEntrySchema,
    eslintReportSchema,
    historyMetadataSchema,
    trufflehogResultSchema,
    markdownlintReportSchema,
} from '#cli/parsers/schema/report.ts';

// One markdownlint entry as a finding, checked against the source line it points at.
function markdownlintFinding(
    check: string,
    help: string,
    entry: MarkdownlintEntry,
    file: string,
    lines: Buffer[],
): Finding {
    const line = lines[entry.lineNumber - 1]?.toString('utf8');
    if (line === undefined || (entry.errorRange !== null && entry.errorRange[0] > line.length + 1))
        throw new GspotError('output', `Markdownlint reported a position outside the source: ${file}`);
    return {
        check,
        file,
        line: entry.lineNumber,
        ...(entry.errorRange === null ? {} : { column: entry.errorRange[0] }),
        rule: entry.ruleNames[0],
        message: [entry.ruleDescription, entry.errorDetail, entry.errorContext]
            .filter((part) => part !== null)
            .join(': '),
        help,
        fixable: entry.fixInfo !== null,
    };
}

// The lines of a source file as bytes, read once per file, so byte offsets can be turned into columns.
function sourceLines(root: string, path: string, cache: Map<string, Buffer[]>): Buffer[] {
    const held = cache.get(path);
    if (held !== undefined) return held;
    let source: Buffer;
    try {
        source = readSource(root, path);
    } catch (error) {
        throw new GspotError('output', `Cannot read reported source file ${path}.`, { cause: error });
    }
    const lines: Buffer[] = [];
    let start = 0;
    for (let index = 0; index < source.length; index += 1)
        if (source[index] === LINE_FEED) {
            lines.push(source.subarray(start, index));
            start = index + 1;
        }
    lines.push(source.subarray(start));
    cache.set(path, lines);
    return lines;
}

// The line and character column of a typo, from the byte offset typos reports.
function typoPosition(
    root: string,
    path: string,
    entry: TypoEntry,
    cache: Map<string, Buffer[]>,
): Pick<Finding, 'line' | 'column'> {
    if (entry.line_num === undefined) return {};
    const sourceLine = sourceLines(root, path, cache)[entry.line_num - 1];
    if (sourceLine === undefined || entry.byte_offset > sourceLine.length)
        throw new GspotError('output', `Typos reported a position outside the source: ${path}`);
    return {
        line: entry.line_num,
        column: codePoints(sourceLine.subarray(0, entry.byte_offset).toString('utf8')).length + 1,
    };
}

// One typos entry as a finding: a filename typo when it has no line, otherwise a positioned one.
function typoFinding(
    check: string,
    help: string,
    entry: TypoEntry,
    path: string,
    position: Pick<Finding, 'line' | 'column'>,
): Finding {
    const corrections = entry.corrections ?? [];
    const replacement = corrections.map((word) => `\`${word}\``).join(', ');
    const text =
        corrections.length === 0 ? `\`${entry.typo}\` is not allowed` : `\`${entry.typo}\` should be ${replacement}`;
    return {
        check,
        file: path,
        help,
        message: entry.line_num === undefined ? `Filename: ${text}` : text,
        fixable: entry.line_num !== undefined && corrections.length === 1,
        ...position,
    };
}

function eslintFinding(check: string, file: string, entry: EslintDiagnostic, help: string): Finding {
    const finding: Finding = { check, file, message: entry.message, help, fixable: entry.fix !== undefined };
    if (entry.line !== undefined) finding.line = entry.line;
    if (entry.column !== undefined) finding.column = entry.column;
    if (entry.ruleId !== null) finding.rule = entry.ruleId;
    return finding;
}

/**
 * Findings from a validated ESLint JSON report.
 * @param check the check name
 * @param text the structured report
 * @param help the check help text
 * @returns findings with ESLint positions and fix availability
 */
export function eslintFindings(check: string, text: string, help: string): Finding[] {
    let files: EslintReport;
    try {
        files = eslintReportSchema.parse(JSON.parse(text));
    } catch (error) {
        throw new GspotError('output', 'ESLint returned invalid structured findings.', { cause: error });
    }
    return files.flatMap((file) =>
        file.messages.map((entry) => eslintFinding(check, toolPath(file.filePath), entry, help)),
    );
}

/**
 * Findings from markdownlint's JSON report, each checked against the source it points at.
 * @param check the check name
 * @param stdout the report
 * @param help the check's help text
 * @param root the repository root
 * @param cwd the directory markdownlint ran in
 * @returns the findings
 */
export function markdownlintFindings(
    check: string,
    stdout: string,
    help: string,
    root: string,
    cwd: string,
): Finding[] {
    let entries: MarkdownlintEntry[];
    try {
        entries = markdownlintReportSchema.parse(JSON.parse(stdout));
    } catch (error) {
        throw new GspotError('output', 'Markdownlint returned invalid structured findings.', { cause: error });
    }
    const sources = new Map<string, Buffer[]>();
    return entries.map((entry) => {
        const file = toPosix(relative(root, resolve(cwd, entry.fileName)));
        return markdownlintFinding(check, help, entry, file, sourceLines(root, file, sources));
    });
}

/**
 * Findings from the JSON lines typos prints. JSON preserves filename delimiters; native offsets count UTF-8 bytes,
 * while report columns count characters.
 * @param check the check name
 * @param stdout the report
 * @param help the check's help text
 * @param root the repository root
 * @param cwd the directory typos ran in
 * @returns the findings
 */
export function typosFindings(check: string, stdout: string, help: string, root: string, cwd: string): Finding[] {
    let entries: TypoEntry[];
    try {
        entries = stdout
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => typosEntrySchema.parse(JSON.parse(line)));
    } catch (error) {
        throw new GspotError('output', 'Typos returned invalid structured findings.', { cause: error });
    }
    const linesByPath = new Map<string, Buffer[]>();
    return entries.map((entry) => {
        const path = toPosix(relative(root, resolve(cwd, entry.path)));
        return typoFinding(check, help, entry, path, typoPosition(root, path, entry, linesByPath));
    });
}

/**
 * Findings from TruffleHog's verified results, one per credential, without the secret itself.
 * @param check the check name
 * @param stdout the JSON lines TruffleHog printed
 * @param help the check's help text
 * @returns the findings
 */
export function trufflehogFindings(check: string, stdout: string, help: string): Finding[] {
    const findings: Finding[] = [];
    for (const line of stdout.split('\n').filter((line) => line.trim() !== '')) {
        try {
            const result = trufflehogResultSchema.parse(JSON.parse(line));
            const metadata = historyMetadataSchema.parse(
                JSON.parse(result.SourceMetadata.Data.JsonEnumerator.metadata),
            );
            findings.push({
                check,
                file: metadata.file,
                rule: result.DetectorName,
                message: `Verified ${result.DetectorName} credential in commit ${metadata.commit}.`,
                help,
                fixable: false,
            });
        } catch {
            throw new GspotError('output', 'TruffleHog returned invalid structured findings; raw output was withheld.');
        }
    }
    return findings;
}
