import type { Node } from 'web-tree-sitter';
// eslint-disable-next-line import-x/no-cycle -- reason: These modules import hoisted functions and read no values during initialization.
import { addIdentifier } from '#cli/checks/general/naming/identifiers.ts';
import type { Identifier, ExtractSink } from '#cli/types/checks/general.ts';

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
 * @param syntaxRoot the parsed shell document that provides declaration nodes.
 * @param file the file path.
 * @returns the declarations found in the tree.
 */
export function extractBashIdentifiers(syntaxRoot: Node, file: string): Identifier[] {
    const sink: ExtractSink = { file, language: 'bash', out: [] };
    addFunctions(sink, syntaxRoot);
    addAssignments(sink, syntaxRoot);
    addDeclarations(sink, syntaxRoot);
    return sink.out;
}
