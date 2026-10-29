import type { Node } from 'web-tree-sitter';
import { addIdentifier } from '#cli/checks/general/naming/languages/identifier.ts';
import type { Identifier, FileIdentifiers } from '#cli/types/checks/general/naming.ts';

function addFunctions(found: FileIdentifiers, syntaxRoot: Node): void {
    for (const node of syntaxRoot.descendantsOfType('function_definition')) {
        const name = node.childForFieldName('name');
        if (name !== null) addIdentifier(found, name, 'functions');
    }
}

function addAssignments(found: FileIdentifiers, syntaxRoot: Node): void {
    for (const node of syntaxRoot.descendantsOfType('variable_assignment')) {
        const name = node.childForFieldName('name');
        if (name?.type === 'variable_name') addIdentifier(found, name, 'variables');
    }
}

function addDeclarations(found: FileIdentifiers, syntaxRoot: Node): void {
    for (const node of syntaxRoot.descendantsOfType('declaration_command'))
        for (const child of node.namedChildren)
            if (child.type === 'variable_name') addIdentifier(found, child, 'variables');
}

/**
Lists the functions and variables that a shell script declares.

@param syntaxRoot the parsed script.
@param file the repository path of the script.
*/
export function extractBashIdentifiers(syntaxRoot: Node, file: string): Identifier[] {
    const found: FileIdentifiers = { file, language: 'bash', identifiers: [] };
    addFunctions(found, syntaxRoot);
    addAssignments(found, syntaxRoot);
    addDeclarations(found, syntaxRoot);
    return found.identifiers;
}
