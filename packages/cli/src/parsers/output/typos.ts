// Reads spelling findings from Typos reports.
import { z } from 'zod';
import { resolve, relative } from 'node:path';
import { LINE_FEED } from '#cli/config/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readSource } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { Finding } from '#cli/types/execution/check.ts';
import type { TypoEntry } from '#cli/types/parsers/output.ts';

// The lines of a source file as bytes, read once per file, so byte offsets map to columns.
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

        column: [...sourceLine.subarray(0, entry.byte_offset).toString('utf8')].length + 1,
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

const typosEntrySchema = z.object({
    type: z.literal('typo'),
    path: z.string().min(1),
    line_num: z.number().int().positive().optional(),
    byte_offset: z.number().int().nonnegative(),
    typo: z.string().min(1),
    corrections: z.array(z.string()).nullable(),
} satisfies SchemaShape<TypoEntry>);

/**
 * Findings from the JSON lines typos prints. JSON preserves filename delimiters; offsets count UTF-8 bytes,
 * while report columns count characters.
 *
 * @param check the check ID.
 * @param stdout the report.
 * @param help the check's help text.
 *
 * @param root the repository root.
 * @param cwd the directory typos ran in.
 * @returns the findings.
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
        const path = convertToPosixPath(relative(root, resolve(cwd, entry.path)));
        return typoFinding(check, help, entry, path, typoPosition(root, path, entry, linesByPath));
    });
}
