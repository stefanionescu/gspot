import type { Node } from 'web-tree-sitter';
import { addIdentifier } from '#cli/checks/naming/languages/identifier.ts';
import type { Identifier, FileIdentifiers } from '#cli/types/checks/naming.ts';

function addFunctions(found: FileIdentifiers, root: Node): void {
    for (const node of root.descendantsOfType('function_definition')) {
        const name = node.childForFieldName('name');
        if (name !== null) addIdentifier(found, name, 'functions');
    }
}

function addAssignments(found: FileIdentifiers, root: Node): void {
    for (const node of root.descendantsOfType('variable_assignment')) {
        const name = node.childForFieldName('name');
        if (name?.type === 'variable_name') addIdentifier(found, name, 'variables');
    }
}

function addDeclarations(found: FileIdentifiers, root: Node): void {
    for (const node of root.descendantsOfType('declaration_command'))
        for (const child of node.namedChildren)
            if (child.type === 'variable_name') addIdentifier(found, child, 'variables');
}

/**
 * Lists the functions and variables that a shell script declares.
 *
 * @param syntaxRoot the parsed script.
 * @param file the repository path of the script.
 * @returns the declared names.
 */
export function extractBashIdentifiers(syntaxRoot: Node, file: string): Identifier[] {
    const found: FileIdentifiers = { file, language: 'bash', out: [] };
    addFunctions(found, syntaxRoot);
    addAssignments(found, syntaxRoot);
    addDeclarations(found, syntaxRoot);
    return found.out;
}
