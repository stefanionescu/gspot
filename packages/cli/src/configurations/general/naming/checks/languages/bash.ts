import type { Node } from 'web-tree-sitter';
import type { Identifier, FileIdentifiers } from '#cli/types/configurations/naming.ts';
import { addIdentifier } from '#cli/configurations/general/naming/checks/languages/identifier.ts';

function addFunctions(found: FileIdentifiers, syntaxRoot: Node): void {
    for (const node of syntaxRoot.descendantsOfType('function_definition')) {
        const name = node.childForFieldName('name');
        if (name !== null) addIdentifier(found, name, 'functions');
    }
}

function addAssignments(found: FileIdentifiers, syntaxRoot: Node): Node[] {
    const names = syntaxRoot
        .descendantsOfType('variable_assignment')
        .flatMap((node) => node.childForFieldName('name') ?? [])
        .filter((name) => name.type === 'variable_name');
    for (const name of names) addIdentifier(found, name, 'variables');
    return names;
}

// A bare name after `readonly`, `export`, or `local` declares a variable only when no earlier line assigns it.
function addDeclarations(found: FileIdentifiers, syntaxRoot: Node, assigned: Node[]): void {
    for (const node of syntaxRoot.descendantsOfType('declaration_command'))
        for (const child of node.namedChildren) {
            if (child.type !== 'variable_name') continue;
            const isAssignedEarlier = assigned.some(
                (name) => name.text === child.text && name.startIndex < child.startIndex,
            );
            if (!isAssignedEarlier) addIdentifier(found, child, 'variables');
        }
}

export function extractBashIdentifiers(syntaxRoot: Node, file: string): Identifier[] {
    const found: FileIdentifiers = { file, language: 'bash', identifiers: [] };
    addFunctions(found, syntaxRoot);
    addDeclarations(found, syntaxRoot, addAssignments(found, syntaxRoot));
    return found.identifiers;
}
