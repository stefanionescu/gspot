import type { Node } from 'web-tree-sitter';
import { createIdentifier } from '#cli/parsers/naming/identifiers.ts';
import type { Identifier, ExtractSink } from '#cli/types/parsers/naming.ts';

function add(sink: ExtractSink, node: Node, category: string): void {
    const name = node.text;
    if (name === '' || name === '_') return;
    sink.out.push(
        createIdentifier(sink, {
            line: node.startPosition.row + 1,
            column: node.startPosition.column + 1,
            category,

            name,
        }),
    );
}

function addFunctions(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('function_definition')) {
        const name = node.childForFieldName('name');
        if (name !== null) add(sink, name, 'functions');
    }
}

function addAssignments(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('variable_assignment')) {
        const name = node.childForFieldName('name');
        if (name?.type === 'variable_name') add(sink, name, 'variables');
    }
}

function addDeclarations(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('declaration_command'))
        for (const child of node.namedChildren) if (child.type === 'variable_name') add(sink, child, 'variables');
}

/**
 * The functions and variables a parsed shell script declares.
 * @param root the tree's root node
 * @param file the file path
 * @returns the declarations found in the tree
 */
export function bashIdentifiers(root: Node, file: string): Identifier[] {
    const sink: ExtractSink = { file, language: 'bash', out: [] };
    addFunctions(sink, root);
    addAssignments(sink, root);
    addDeclarations(sink, root);
    return sink.out;
}
