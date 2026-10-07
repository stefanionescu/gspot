import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/finding.ts';
import { visitParsed } from '#cli/parsers/tree-sitter.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { PythonModule } from '#cli/types/parsers/python.ts';
import { readPython, disposePython } from '#cli/parsers/python.ts';
import { IMPORTS, DIRECTIVE } from '#cli/config/checks/language/python.ts';

// The runs of top-level import statements, from the first import of each to the last. Only comments may lie between two imports of a run.
function importRuns(module: PythonModule): [Node, Node][] {
    const runs: [Node, Node][] = [];
    let open = false;
    for (const node of module.tree.rootNode.namedChildren.filter((child) => child.type !== 'comment')) {
        const current = runs.at(-1);
        if (!IMPORTS.has(node.type)) open = false;
        else if (open && current !== undefined) current[1] = node;
        else {
            runs.push([node, node]);
            open = true;
        }
    }
    return runs;
}

/**
 * Comments written among a module's imports, from the first import to the last. A tool directive is not a comment.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function importComments(input: CheckInput): Promise<Finding[]> {
    using parsed = await visitParsed(input, readPython, disposePython);
    const { modules } = parsed.value;
    return modules.flatMap((module) => {
        const findings: Finding[] = [];
        const comments = module.tree.rootNode.namedChildren.filter((node) => node.type === 'comment');
        for (const [first, last] of importRuns(module)) {
            for (const node of comments) {
                if (
                    node.startIndex <= first.startIndex ||
                    node.startPosition.row > last.endPosition.row ||
                    DIRECTIVE.test(node.text)
                )
                    continue;
                findings.push(
                    findingAt(
                        input,
                        { file: module.path, line: node.startPosition.row + 1 },
                        'import-comment',
                        'No comments among imports. Say it where the import is used, or above the block.',
                    ),
                );
            }
        }
        return findings;
    });
}
