import type { Node } from 'web-tree-sitter';

import { addIdentifier } from '#cli/configurations/general/naming/languages/identifier.ts';
import type { FileIdentifiers, Identifier } from '#cli/types/configurations/general.ts';

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

export function extractBashIdentifiers(syntaxRoot: Node, file: string): Identifier[] {
    const found: FileIdentifiers = { file, language: 'bash', identifiers: [] };
    addFunctions(found, syntaxRoot);
    addAssignments(found, syntaxRoot);
    addDeclarations(found, syntaxRoot);
    return found.identifiers;
}
