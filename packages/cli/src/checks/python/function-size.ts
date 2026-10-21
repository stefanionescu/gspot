import { buildFinding } from '#cli/runs/finding.ts';
import { parseSource } from '#cli/parsers/grammars.ts';
import { getLimit } from '#cli/settings/scope-view.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { COMMENT_MARKERS } from '#cli/config/checks/structure.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';

async function checkFile(session: Session, planned: PlannedCheck, path: string, limit: number): Promise<Finding[]> {
    const text = readCachedText(session.reads, path);
    const lines = text.split('\n');
    const tree = await parseSource('python', text);
    try {
        return tree.rootNode.descendantsOfType('function_definition').flatMap((node) => {
            const count = lines
                .slice(node.startPosition.row, node.endPosition.row + 1)
                .filter((line) => line.trim() !== '' && !line.trimStart().startsWith(COMMENT_MARKERS.python)).length;
            if (count <= limit) return [];
            const name = node.childForFieldName('name')?.text ?? 'function';
            return [
                buildFinding(
                    planned,
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
 *
 * @param session the repository and its tools.
 * @param planned the scope files and limits.
 * @returns one finding per function over the limit.
 */
export async function checkPythonFunctionSize(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const limit = getLimit(planned.selection.view, 'function_lines', 'python');
    const files = planned.files.filter((file) => file.path.endsWith('.py'));
    const findings = await Promise.all(files.map((file) => checkFile(session, planned, file.path, limit)));
    return findings.flat();
}
