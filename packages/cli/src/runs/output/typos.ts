import { resolve, relative } from 'node:path';
import { LINE_FEED } from '#cli/config/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { reportedTypoSchema } from '#cli/schemas/runs/typos.ts';
import type { ToolOutput, ReportedTypo } from '#cli/types/runs/output.ts';

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

function findTypoPosition(
    root: string,
    path: string,
    typo: ReportedTypo,
    cache: Map<string, Buffer[]>,
): Pick<Finding, 'line' | 'column'> {
    if (typo.line_num === undefined) return {};
    const sourceLine = readSourceLines(root, path, cache)[typo.line_num - 1];
    if (sourceLine === undefined || typo.byte_offset > sourceLine.length)
        throw new GspotError('output', `typos reported a position outside the file: ${path}`);
    return {
        line: typo.line_num,

        column: [...sourceLine.subarray(0, typo.byte_offset).toString('utf8')].length + 1,
    };
}

function buildTypoFinding(
    output: ToolOutput,
    typo: ReportedTypo,
    path: string,
    position: Pick<Finding, 'line' | 'column'>,
): Finding {
    const corrections = typo.corrections ?? [];
    const replacement = corrections.map((word) => `\`${word}\``).join(', ');
    const text =
        corrections.length === 0 ? `\`${typo.typo}\` is not allowed` : `\`${typo.typo}\` should be ${replacement}`;
    return {
        check: output.check,
        file: path,
        help: output.help,
        message: typo.line_num === undefined ? `Filename: ${text}` : text,
        fixable: typo.line_num !== undefined && corrections.length === 1,
        ...position,
    };
}

/**
Read the JSON lines that typos prints. JSON keeps filename delimiters. Offsets count UTF-8 bytes,
but report columns count characters.

@param output the tool output to read.
@returns source positions with byte offsets converted to character columns.
*/
export function parseTyposFindings(output: ToolOutput): Finding[] {
    const { stdout, root, cwd } = output;
    const typos = stdout
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => parseToolOutput('Typos', line, reportedTypoSchema));
    const linesByPath = new Map<string, Buffer[]>();
    return typos.map((typo) => {
        const path = resolve(cwd, typo.path);
        const local = convertToPosixPath(relative(root, path));
        return buildTypoFinding(output, typo, path, findTypoPosition(root, local, typo, linesByPath));
    });
}
