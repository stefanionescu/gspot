import type { Node } from 'web-tree-sitter';
import type { NamedCategory } from '#cli/types/settings/naming.ts';
import { addIdentifier } from '#cli/checks/general/naming/languages/identifier.ts';
import type { Identifier, FileIdentifiers } from '#cli/types/checks/general/naming.ts';

import {
    NAME_NODES,
    DECLARATIONS,
    PATTERN_LISTS,
    PATTERN_FIELDS,
    COMPONENT_FACTORY,
    TYPESCRIPT_CALLABLE_NODES,
    TYPESCRIPT_PARAMETER_NODES,
} from '#cli/config/checks/general/naming/languages.ts';

function addPattern(found: FileIdentifiers, node: Node | null, category: NamedCategory): void {
    if (node === null) return;
    const field = PATTERN_FIELDS[node.type];
    if (NAME_NODES.has(node.type))
        addIdentifier(
            found,
            node,
            category,
            node.type === 'private_property_identifier' ? node.text.slice(1) : node.text,
        );
    else if (field !== undefined) addPattern(found, node.childForFieldName(field), category);
    else if (PATTERN_LISTS.has(node.type)) for (const child of node.namedChildren) addPattern(found, child, category);
}

function addParameter(found: FileIdentifiers, parameter: Node): void {
    const pattern = parameter.childForFieldName('pattern');
    addPattern(found, pattern, 'parameters');
    if (parameter.namedChildren.some((child) => child.type === 'accessibility_modifier'))
        addPattern(found, pattern, 'properties');
}

function addParameters(found: FileIdentifiers, node: Node): void {
    const parameters = node.childForFieldName('parameters')?.namedChildren ?? [];
    for (const parameter of parameters) {
        if (TYPESCRIPT_PARAMETER_NODES.has(parameter.type)) addParameter(found, parameter);
        else addPattern(found, parameter, 'parameters');
    }
    addPattern(found, node.childForFieldName('parameter'), 'parameters');
}

function isImportedName(node: Node): boolean {
    const value = node.childForFieldName('value');
    if (value === null) return false;
    const awaited = value.type === 'await_expression' ? value.namedChildren[0] : value;
    if (awaited?.type !== 'call_expression') return false;
    const callee = awaited.childForFieldName('function');
    return callee?.type === 'import' || callee?.text === 'require';
}

function addDeclarator(found: FileIdentifiers, declarator: Node): void {
    const start = found.identifiers.length;
    addPattern(found, declarator.childForFieldName('name'), 'variables');
    const value = declarator.childForFieldName('value');
    if (value?.type === 'call_expression' && COMPONENT_FACTORY.test(value.childForFieldName('function')?.text ?? ''))
        for (const identifier of found.identifiers.slice(start)) identifier.addedCases = ['pascal'];
}

function addDeclarations(found: FileIdentifiers, syntaxRoot: Node): void {
    for (const [types, category] of DECLARATIONS) {
        const nodes = syntaxRoot
            .descendantsOfType([...types])
            .filter(
                (node) =>
                    !(
                        category === 'methods' &&
                        (node.childForFieldName('name')?.text === 'constructor' || node.parent?.type === 'object')
                    ),
            );
        for (const node of nodes) addPattern(found, node.childForFieldName('name'), category);
    }
}

function addEnumCases(found: FileIdentifiers, syntaxRoot: Node): void {
    for (const body of syntaxRoot.descendantsOfType('enum_body')) {
        const cases = body.namedChildren.filter((child) => child.type === 'property_identifier');
        for (const child of cases) addIdentifier(found, child, 'enum_cases');
    }
}

/**
Lists the names that a TypeScript or JavaScript file declares.

@param syntaxRoot the parsed program.
@param file the repository path of the source.
@param language `typescript` or `javascript`.
*/
export function extractTypescriptIdentifiers(syntaxRoot: Node, file: string, language: string): Identifier[] {
    const found: FileIdentifiers = { file, language, identifiers: [] };
    addDeclarations(found, syntaxRoot);
    addEnumCases(found, syntaxRoot);
    const declarators = syntaxRoot.descendantsOfType('variable_declarator').filter((node) => !isImportedName(node));
    for (const node of declarators) addDeclarator(found, node);
    for (const node of syntaxRoot.descendantsOfType('for_in_statement'))
        addPattern(found, node.childForFieldName('left'), 'variables');
    for (const node of syntaxRoot.descendantsOfType('catch_clause'))
        addPattern(found, node.childForFieldName('parameter'), 'variables');
    const callables = syntaxRoot.descendantsOfType([...TYPESCRIPT_CALLABLE_NODES]);
    for (const node of callables) addParameters(found, node);
    return found.identifiers;
}
