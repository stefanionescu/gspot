// Findings from the structured reports of specific tools: markdownlint, typos, and TruffleHog.
import { z } from 'zod';
import { relative, resolve } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import type { Finding } from '#cli/checks/result.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { codePoints } from '#cli/platform/code-points.ts';

type TypoEntry = z.infer<typeof typosEntry>;

const LINE_FEED = 10;

const markdownlintEntries = z.array(
    z.object({
        fileName: z.string().min(1),
        lineNumber: z.number().int().positive(),
        ruleNames: z.tuple([z.string().min(1)]).rest(z.string().min(1)),
        ruleDescription: z.string().min(1),
        errorDetail: z.string().nullable(),
        errorContext: z.string().nullable(),
        errorRange: z.tuple([z.number().int().positive(), z.number().int().nonnegative()]).nullable(),
        fixInfo: z.record(z.string(), z.unknown()).nullable(),
        severity: z.enum(['error', 'warning']),
    }),
);

// One markdownlint entry as a finding, checked against the source line it points at.
function markdownlintFinding(
    check: string,
    help: string,
    entry: z.infer<typeof markdownlintEntries>[number],
    file: string,
    lines: string[],
): Finding {
    const line = lines[entry.lineNumber - 1];
    if (line === undefined || (entry.errorRange !== null && entry.errorRange[0] > line.length + 1))
        throw new Error(`The reported position is outside the source: ${file}`);
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

const trufflehogFinding = z.object({
    DetectorName: z.string().min(1),
    Verified: z.literal(true),
    SourceMetadata: z.object({ Data: z.object({ JsonEnumerator: z.object({ metadata: z.string() }) }) }),
});
const historyMetadata = z.object({ commit: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u), file: z.string() });

const typosEntry = z.object({
    type: z.literal('typo'),
    path: z.string().min(1),
    line_num: z.number().int().positive().optional(),
    byte_offset: z.number().int().nonnegative(),
    typo: z.string().min(1),
    corrections: z.array(z.string()).nullable(),
});

// The lines of a source file as bytes, read once per file, so byte offsets can be turned into columns.
function sourceLines(root: string, path: string, cache: Map<string, Buffer[]>): Buffer[] {
    const held = cache.get(path);
    if (held !== undefined) return held;
    const source = readSource(root, path);
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
        throw new Error(`The reported position is outside the source: ${path}`);
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
    const message =
        corrections.length === 0 ? `\`${entry.typo}\` is not allowed` : `\`${entry.typo}\` should be ${replacement}`;
    return {
        check,
        file: path,
        help,
        message: entry.line_num === undefined ? `Filename: ${message}` : message,
        fixable: entry.line_num !== undefined && corrections.length === 1,
        ...position,
    };
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
    const sources = new Map<string, string[]>();
    try {
        return markdownlintEntries.parse(JSON.parse(stdout)).map((entry) => {
            const file = toPosix(relative(root, resolve(cwd, entry.fileName)));
            const lines = sources.get(file) ?? readSource(root, file).toString('utf8').split('\n');
            sources.set(file, lines);
            return markdownlintFinding(check, help, entry, file, lines);
        });
    } catch (error) {
        throw new ToolOutputError('Markdownlint returned invalid structured findings or unavailable source.', {
            cause: error,
        });
    }
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
    const linesByPath = new Map<string, Buffer[]>();
    try {
        return stdout
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => {
                const entry = typosEntry.parse(JSON.parse(line));
                const path = toPosix(relative(root, resolve(cwd, entry.path)));
                return typoFinding(check, help, entry, path, typoPosition(root, path, entry, linesByPath));
            });
    } catch (error) {
        throw new ToolOutputError('The typos output holds invalid structured findings or an unavailable source.', {
            cause: error,
        });
    }
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
            const result = trufflehogFinding.parse(JSON.parse(line));
            const metadata = historyMetadata.parse(JSON.parse(result.SourceMetadata.Data.JsonEnumerator.metadata));
            findings.push({
                check,
                file: metadata.file,
                rule: result.DetectorName,
                message: `Verified ${result.DetectorName} credential in commit ${metadata.commit}.`,
                help,
                fixable: false,
            });
        } catch {
            throw new ToolOutputError('TruffleHog returned invalid structured findings; raw output was withheld.');
        }
    }
    return findings;
}

/** A tool response that cannot be interpreted safely as findings. */
export class ToolOutputError extends Error {
    override name = 'ToolOutputError';
}
