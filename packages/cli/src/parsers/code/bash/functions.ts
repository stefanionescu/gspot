import type { Node } from 'web-tree-sitter';

import {
    ALL_POSITIONAL_PARAMETERS,
    BASH_BRANCH_NODES,
    BASH_COMPOUND_NODES,
    EXPANSION_NODES,
    FOR_HEADER_FIELDS,
    GETOPTS_COMMAND,
    POSITIONAL_PARAMETER,
    SHIFT_COMMAND,
} from '#cli/config/parsers/code.ts';
import type { ScriptSyntax } from '#cli/types/parsers.ts';

function findHighestParameter(node: Node): number {
    const expansions = node.descendantsOfType([...EXPANSION_NODES]);
    const positions = expansions.flatMap((expansion) => {
        if (findFunctionNode(expansion)?.id !== node.id) return [];
        const parameter = expansion.namedChildren[0]?.text;
        if (parameter === undefined) return [];
        if (ALL_POSITIONAL_PARAMETERS.has(parameter)) return [Infinity];
        return POSITIONAL_PARAMETER.test(parameter) ? [Number(parameter)] : [];
    });
    if (
        node
            .descendantsOfType('command')
            .some(
                (command) =>
                    findFunctionNode(command)?.id === node.id &&
                    [SHIFT_COMMAND, GETOPTS_COMMAND].includes(command.childForFieldName('name')?.text ?? ''),
            )
    )
        return Infinity;
    return Math.max(0, ...positions);
}

export function findFunctionNode(node: Node): Node | undefined {
    let parent = node.parent;
    while (parent !== null) {
        if (parent.type === 'function_definition') return parent;
        parent = parent.parent;
    }
    return undefined;
}

export function parseBashFunctions(syntaxRoot: Node): ScriptSyntax['functions'] {
    return syntaxRoot.descendantsOfType('function_definition').flatMap((node) => {
        const name = node.childForFieldName('name')?.text;
        const body = node.childForFieldName('body');
        if (name === undefined || body === null) return [];
        const controls = node
            .descendantsOfType([...BASH_BRANCH_NODES, ...BASH_COMPOUND_NODES])
            .filter((child) => findFunctionNode(child)?.id === node.id);
        const compoundNodes = controls.filter((child) => BASH_COMPOUND_NODES.includes(child.type));

        const nesting = Math.max(
            0,
            ...compoundNodes.map((child) => {
                let depth = 1;
                for (let parent = child.parent; parent !== null && parent.id !== node.id; parent = parent.parent) {
                    const parentId = parent.id;
                    if (compoundNodes.some((compound) => compound.id === parentId)) depth += 1;
                }
                return depth;
            }),
        );
        const ignored = [
            ...node.descendantsOfType('declaration_command'),
            ...compoundNodes
                .filter((control) => control.type === 'c_style_for_statement')
                .flatMap((loop) => FOR_HEADER_FIELDS.flatMap((field) => loop.childrenForFieldName(field))),
        ];
        return [
            {
                name,
                start: node.startPosition.row + 1,
                end: node.endPosition.row + 1,
                highestRead: findHighestParameter(node),
                branches: controls.filter((child) => BASH_BRANCH_NODES.includes(child.type)).length,
                nesting,
                assignments: node
                    .descendantsOfType('variable_assignment')
                    .filter(
                        (write) =>
                            findFunctionNode(write)?.id === node.id &&
                            ignored.every(
                                (range) => !(range.startIndex <= write.startIndex && range.endIndex >= write.endIndex),
                            ),
                    ).length,
            },
        ];
    });
}
