import type { Node } from 'web-tree-sitter';
import { addIdentifier } from '#cli/parsers/naming/contracts.ts';
import type { Identifier, ExtractSink } from '#cli/types/parsers/naming.ts';

function addFunctions(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('function_definition')) {
        const name = node.childForFieldName('name');
        if (name !== null) addIdentifier(sink, name, 'functions');
    }
}

function addAssignments(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('variable_assignment')) {
        const name = node.childForFieldName('name');
        if (name?.type === 'variable_name') addIdentifier(sink, name, 'variables');
    }
}

function addDeclarations(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('declaration_command'))
        for (const child of node.namedChildren)
            if (child.type === 'variable_name') addIdentifier(sink, child, 'variables');
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
