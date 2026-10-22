import { resolve, relative } from 'node:path';
import { LINE_FEED } from '#cli/config/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { parseToolReport } from '#cli/parsers/json.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { ToolOutput } from '#cli/types/runs/output.ts';
import type { ReportedTypo } from '#cli/types/runs/tool-reports.ts';
import { reportedTypoSchema } from '#cli/schemas/runs/output/typos.ts';

// Read the lines of a source file as bytes, once per file, so byte offsets map to columns.
function readSourceLines(root: string, path: string, cache: Map<string, Buffer[]>): Buffer[] {
    const held = cache.get(path);
    if (held !== undefined) return held;
    let source: Buffer;
    try {
        source = readBytes(root, path);
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

// Get the line and character column of a typo from the byte offset that typos reports.
function getTypoPosition(
    root: string,
    path: string,
    entry: ReportedTypo,
    cache: Map<string, Buffer[]>,
): Pick<Finding, 'line' | 'column'> {
    if (entry.line_num === undefined) return {};
    const sourceLine = readSourceLines(root, path, cache)[entry.line_num - 1];
    if (sourceLine === undefined || entry.byte_offset > sourceLine.length)
        throw new GspotError('output', `typos reported a position outside the file: ${path}`);
    return {
        line: entry.line_num,

        column: [...sourceLine.subarray(0, entry.byte_offset).toString('utf8')].length + 1,
    };
}

// Turn one typos entry into a finding: a filename typo when it has no line, otherwise a positioned one.
function buildTypoFinding(
    output: ToolOutput,
    entry: ReportedTypo,
    path: string,
    position: Pick<Finding, 'line' | 'column'>,
): Finding {
    const corrections = entry.corrections ?? [];
    const replacement = corrections.map((word) => `\`${word}\``).join(', ');
    const text =
        corrections.length === 0 ? `\`${entry.typo}\` is not allowed` : `\`${entry.typo}\` should be ${replacement}`;
    return {
        check: output.check,
        file: path,
        help: output.help,
        message: entry.line_num === undefined ? `Filename: ${text}` : text,
        fixable: entry.line_num !== undefined && corrections.length === 1,
        ...position,
    };
}

/**
 * Read the JSON lines that typos prints. JSON keeps filename delimiters. Offsets count UTF-8 bytes,
 * but report columns count characters.
 *
 * @param output the tool output to read.
 * @returns source positions with byte offsets converted to character columns.
 */
export function parseTyposFindings(output: ToolOutput): Finding[] {
    const { stdout, root, cwd } = output;
    const entries = stdout
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => parseToolReport('Typos', line, reportedTypoSchema));
    const linesByPath = new Map<string, Buffer[]>();
    return entries.map((entry) => {
        const path = resolve(cwd, entry.path);
        return buildTypoFinding(
            output,
            entry,
            path,
            getTypoPosition(root, convertToPosixPath(relative(root, path)), entry, linesByPath),
        );
    });
}
