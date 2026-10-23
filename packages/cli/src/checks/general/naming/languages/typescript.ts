import type { Node } from 'web-tree-sitter';
import type { NamedCategory } from '#cli/types/settings/naming.ts';
import { addIdentifier } from '#cli/checks/general/naming/languages/identifier.ts';
import type { Identifier, FileIdentifiers } from '#cli/types/checks/general/naming.ts';

import {
    COMPONENT_FACTORY,
    TYPESCRIPT_NAME_NODES,
    TYPESCRIPT_DECLARATIONS,
    TYPESCRIPT_PATTERN_LISTS,
    TYPESCRIPT_CALLABLE_NODES,
    TYPESCRIPT_PATTERN_FIELDS,
    TYPESCRIPT_PARAMETER_NODES,
} from '#cli/config/checks/general/naming/languages/typescript.ts';

function addPattern(found: FileIdentifiers, node: Node | null, category: NamedCategory): void {
    if (node === null) return;
    const patternFields: Readonly<Record<string, string>> = TYPESCRIPT_PATTERN_FIELDS;
    if (TYPESCRIPT_NAME_NODES.has(node.type))
        addIdentifier(
            found,
            node,
            category,
            node.type === 'private_property_identifier' ? node.text.slice(1) : node.text,
        );
    else if (patternFields[node.type] !== undefined)
        addPattern(found, node.childForFieldName(patternFields[node.type] ?? ''), category);
    else if (TYPESCRIPT_PATTERN_LISTS.has(node.type))
        for (const child of node.namedChildren) addPattern(found, child, category);
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

// `const { existsSync } = require('node:fs')` and `const { default: X } = await import('x')` bind names another module
// declared. Check the name of any other awaited value as a local declaration.
function isImportedName(node: Node): boolean {
    const value = node.childForFieldName('value');
    if (value === null) return false;
    const awaited = value.type === 'await_expression' ? value.namedChildren[0] : value;
    if (awaited?.type !== 'call_expression') return false;
    const callee = awaited.childForFieldName('function');
    return callee?.type === 'import' || callee?.text === 'require';
}

function isComponentFactory(declarator: Node): boolean {
    const value = declarator.childForFieldName('value');
    if (value?.type !== 'call_expression') return false;
    return COMPONENT_FACTORY.test(value.childForFieldName('function')?.text ?? '');
}

function addDeclarator(found: FileIdentifiers, declarator: Node): void {
    const start = found.out.length;
    addPattern(found, declarator.childForFieldName('name'), 'variables');
    if (isComponentFactory(declarator))
        for (const identifier of found.out.slice(start)) identifier.addedCases = ['pascal'];
}

function addNamed(found: FileIdentifiers, root: Node): void {
    for (const [types, category] of TYPESCRIPT_DECLARATIONS) {
        const nodes = root
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

function addEnumCases(found: FileIdentifiers, root: Node): void {
    for (const body of root.descendantsOfType('enum_body')) {
        const cases = body.namedChildren.filter((child) => child.type === 'property_identifier');
        for (const child of cases) addIdentifier(found, child, 'enum_cases');
    }
}

/**
 * Lists the names that a TypeScript or JavaScript file declares.
 *
 * @param syntaxRoot the parsed program.
 * @param file the repository path of the source.
 * @param language `typescript` or `javascript`.
 * @returns the declared names.
 */
export function extractTypescriptIdentifiers(syntaxRoot: Node, file: string, language: string): Identifier[] {
    const found: FileIdentifiers = { file, language, out: [] };
    addNamed(found, syntaxRoot);
    addEnumCases(found, syntaxRoot);
    const declarators = syntaxRoot.descendantsOfType('variable_declarator').filter((node) => !isImportedName(node));
    for (const node of declarators) addDeclarator(found, node);
    const callables = syntaxRoot.descendantsOfType([...TYPESCRIPT_CALLABLE_NODES]);
    for (const node of callables) addParameters(found, node);
    return found.out;
}
