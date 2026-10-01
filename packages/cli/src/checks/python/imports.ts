import type { Node } from 'web-tree-sitter';
import { assignmentOf } from '#cli/checks/python/modules.ts';
import type { PythonModule, StructureProblem } from '#cli/types/checks.ts';
import { IMPORTS, DIRECTIVE, CLASS_CALL, SINGLETONS_ALLOWED } from '#cli/config/checks/python.ts';

// A module variable that holds an object built from a class at import time, or undefined. A name in capitals is a constant.
function builtAtImport(statement: Node): string | undefined {
    const assignment = assignmentOf(statement);
    if (assignment === undefined) return undefined;
    const name = assignment.childForFieldName('left');
    if (name?.type !== 'identifier' || name.text === name.text.toUpperCase()) return undefined;
    const built = assignment.childForFieldName('right');
    return built?.type === 'call' && CLASS_CALL.test(built.text) ? name.text : undefined;
}

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
 * Objects built when the module is imported: one shared instance that every importer gets and no test replaces.
 * @param modules every module of the run
 * @param allowed the names the policy allows beside the shipped ones
 * @returns the problems
 */
export function singletons(modules: PythonModule[], allowed: Set<string>): StructureProblem[] {
    return modules.flatMap((module) =>
        module.statements.flatMap((statement): StructureProblem[] => {
            const name = builtAtImport(statement);
            if (name === undefined || SINGLETONS_ALLOWED.has(name) || allowed.has(name)) return [];
            return [
                {
                    file: module.path,
                    line: statement.startPosition.row + 1,
                    rule: 'no-singletons',
                    text: `${name} is built when the module is imported, so every importer shares it. Build it where it is used, and pass it in.`,
                },
            ];
        }),
    );
}

/**
 * Comments written among a module's imports, from the first import to the last. A tool directive is not a comment.
 * @param modules every module of the run
 * @returns the problems
 */
export function importComments(modules: PythonModule[]): StructureProblem[] {
    return modules.flatMap((module) =>
        importRuns(module).flatMap(([first, last]) =>
            module.tree.rootNode.namedChildren
                .filter(
                    (node) =>
                        node.type === 'comment' &&
                        node.startIndex > first.startIndex &&
                        node.startPosition.row <= last.endPosition.row &&
                        !DIRECTIVE.test(node.text),
                )
                .map((node) => ({
                    file: module.path,
                    line: node.startPosition.row + 1,
                    rule: 'import-comment',
                    text: 'No comments among imports. Say it where the import is used, or above the block.',
                })),
        ),
    );
}
