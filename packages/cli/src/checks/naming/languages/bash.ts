import type { Node } from 'web-tree-sitter';
import { addIdentifier } from '#cli/checks/naming/languages/identifier.ts';
import type { Identifier, ExtractSink } from '#cli/types/checks/naming.ts';

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
 * Lists the functions and variables that a shell script declares.
 *
 * @param syntaxRoot the parsed script.
 * @param file the repository path of the script.
 * @returns the declared names.
 */
export function extractBashIdentifiers(syntaxRoot: Node, file: string): Identifier[] {
    const sink: ExtractSink = { file, language: 'bash', out: [] };
    addFunctions(sink, syntaxRoot);
    addAssignments(sink, syntaxRoot);
    addDeclarations(sink, syntaxRoot);
    return sink.out;
}
