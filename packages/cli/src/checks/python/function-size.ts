import { buildFinding } from '#cli/runs/finding.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { COMMENT_MARKERS } from '#cli/config/checks/structure.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';

function countCodeLines(lines: string[], start: number, end: number): number {
    return lines
        .slice(start, end + 1)
        .filter((line) => line.trim() !== '' && !line.trimStart().startsWith(COMMENT_MARKERS.python)).length;
}

async function checkFile(input: CheckInput, path: string, limit: number): Promise<Finding[]> {
    const text = readCachedText(input.reads, path) ?? '';
    const lines = text.split('\n');
    const tree = await parseSource('python', text);
    try {
        return tree.rootNode.descendantsOfType('function_definition').flatMap((node) => {
            const count = countCodeLines(lines, node.startPosition.row, node.endPosition.row);
            if (count <= limit) return [];
            const name = node.childForFieldName('name')?.text ?? 'function';
            return [
                buildFinding(
                    input,
                    { file: path, line: node.startPosition.row + 1 },
                    'function-lines',
                    `${name} has ${String(count)} code lines, over the limit of ${String(limit)}.`,
                ),
            ];
        });
    } finally {
        tree.delete();
    }
}

/**
 * Checks each Python function against limits.function_lines, counting code lines only.
 * @param input the scope files and limits.
 * @returns one finding per function over the limit.
 */
export async function checkPythonFunctionSize(input: CheckInput): Promise<Finding[]> {
    const limit = input.selection.view.limit('function_lines', 'python');
    const files = input.files.filter((file) => file.path.endsWith('.py'));
    const findings = await Promise.all(files.map((file) => checkFile(input, file.path, limit)));
    return findings.flat();
}
