import type { Node } from 'web-tree-sitter';
import { addIdentifier } from '#cli/checks/naming/collect.ts';
import type { Identifier, ExtractSink, NamedCategory } from '#cli/types/checks/naming.ts';

import {
    TYPESCRIPT_NAME_NODES,
    TYPESCRIPT_DECLARATIONS,
    TYPESCRIPT_PATTERN_LISTS,
    TYPESCRIPT_CALLABLE_NODES,
    TYPESCRIPT_PATTERN_FIELDS,
    TYPESCRIPT_PARAMETER_NODES,
} from '#cli/config/checks/naming.ts';

function addPattern(sink: ExtractSink, node: Node | null, category: NamedCategory): void {
    if (node === null) return;
    const patternFields: Readonly<Record<string, string>> = TYPESCRIPT_PATTERN_FIELDS;
    if (TYPESCRIPT_NAME_NODES.has(node.type))
        addIdentifier(
            sink,
            node,
            category,
            node.type === 'private_property_identifier' ? node.text.slice(1) : node.text,
        );
    else if (patternFields[node.type] !== undefined)
        addPattern(sink, node.childForFieldName(patternFields[node.type] ?? ''), category);
    else if (TYPESCRIPT_PATTERN_LISTS.has(node.type))
        for (const child of node.namedChildren) addPattern(sink, child, category);
}

function addParameter(sink: ExtractSink, parameter: Node): void {
    const pattern = parameter.childForFieldName('pattern');
    addPattern(sink, pattern, 'parameters');
    if (parameter.namedChildren.some((child) => child.type === 'accessibility_modifier'))
        addPattern(sink, pattern, 'properties');
}

function addParameters(sink: ExtractSink, node: Node): void {
    const parameters = node.childForFieldName('parameters')?.namedChildren ?? [];
    for (const parameter of parameters) {
        if (TYPESCRIPT_PARAMETER_NODES.has(parameter.type)) addParameter(sink, parameter);
        else addPattern(sink, parameter, 'parameters');
    }
    addPattern(sink, node.childForFieldName('parameter'), 'parameters');
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

function addNamed(sink: ExtractSink, root: Node): void {
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
        for (const node of nodes) addPattern(sink, node.childForFieldName('name'), category);
    }
}

function addEnumCases(sink: ExtractSink, root: Node): void {
    for (const body of root.descendantsOfType('enum_body')) {
        const cases = body.namedChildren.filter((child) => child.type === 'property_identifier');
        for (const child of cases) addIdentifier(sink, child, 'enum_cases');
    }
}

/**
 * Lists the names that a TypeScript or JavaScript file declares.
 * @param syntaxRoot the parsed program.
 * @param file the repository path of the source.
 * @param language `typescript` or `javascript`.
 * @returns the declared names.
 */
export function extractTypescriptIdentifiers(syntaxRoot: Node, file: string, language: string): Identifier[] {
    const sink: ExtractSink = { file, language, out: [] };
    addNamed(sink, syntaxRoot);
    addEnumCases(sink, syntaxRoot);
    const declarators = syntaxRoot.descendantsOfType('variable_declarator').filter((node) => !isImportedName(node));
    for (const node of declarators) addPattern(sink, node.childForFieldName('name'), 'variables');
    const callables = syntaxRoot.descendantsOfType([...TYPESCRIPT_CALLABLE_NODES]);
    for (const node of callables) addParameters(sink, node);
    return sink.out;
}
