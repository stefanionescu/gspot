import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { visitParsed } from '#cli/parsers/source/public.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { HouseSource } from '#cli/types/checks/general/structure.ts';
import { SHELLCHECK_DIRECTIVE } from '#cli/config/checks/language/bash.ts';
import { DIRECTIVE as SWIFT_DIRECTIVE } from '#cli/config/checks/language/swift.ts';
import { DIRECTIVE as PYTHON_DIRECTIVE } from '#cli/config/checks/language/python.ts';
import { readHouseSources, disposeHouseSources } from '#cli/checks/general/structure/conventions.ts';

// Native import blocks break at executable statements, except Swift's file-wide import range.
function importRuns(source: HouseSource): [Node, Node][] {
    const imported = new Set(
        (source.captures.get('import') ?? [])
            .filter(
                (node) =>
                    source.language !== 'bash' || ['source', '.'].includes(node.childForFieldName('name')?.text ?? ''),
            )
            .map((node) => node.id),
    );
    const runs: [Node, Node][] = [];
    let open = false;
    for (const node of source.tree.rootNode.namedChildren.filter((child) => !child.type.includes('comment'))) {
        const current = runs.at(-1);
        if (!imported.has(node.id)) {
            open &&= source.language === 'swift';
            continue;
        }
        if (open && current !== undefined) current[1] = node;
        else {
            runs.push([node, node]);
            open = true;
        }
    }
    return runs;
}

/**
 * Report prose comments between native top-level imports, retaining tool directives.
 * @param input the selected sources and scope policy
 * @returns findings at each comment's original line
 */
export async function importComments(input: CheckInput): Promise<Finding[]> {
    using parsed = await visitParsed(input, readHouseSources, disposeHouseSources);
    return parsed.value.flatMap((source) => {
        const directives = { bash: SHELLCHECK_DIRECTIVE, python: PYTHON_DIRECTIVE, swift: SWIFT_DIRECTIVE };
        const comments = (source.captures.get('comment') ?? []).filter(
            (node) => node.parent?.id === source.tree.rootNode.id && !directives[source.language].test(node.text),
        );
        const message =
            source.language === 'bash'
                ? 'No comments among source statements. Say it where the sourced file is used, or above the block.'
                : 'No comments among imports. Say it where the import is used, or above the block.';
        return importRuns(source).flatMap(([first, last]) =>
            comments
                .filter((node) => node.startIndex > first.startIndex && node.startPosition.row <= last.endPosition.row)
                .map((node) =>
                    findingAt(
                        input,
                        { file: source.path, line: node.startPosition.row + 1 },
                        source.language === 'bash' ? 'source-comment' : 'import-comment',
                        message,
                    ),
                ),
        );
    });
}
