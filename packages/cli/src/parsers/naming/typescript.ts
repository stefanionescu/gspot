import type { Node } from 'web-tree-sitter';
import { addIdentifier } from '#cli/parsers/naming/identifiers.ts';
import type { Identifier, ExtractSink } from '#cli/types/parsers/naming.ts';

import {
    NAME_NODES,
    PATTERN_LISTS,
    PATTERN_FIELDS,
    NAMED_DECLARATIONS,
    TYPESCRIPT_METHOD_NODES,
    TYPESCRIPT_FUNCTION_NODES,
    TYPESCRIPT_PARAMETER_NODES,
} from '#cli/config/parsers/naming.ts';

function addPattern(sink: ExtractSink, node: Node | null, category: string): void {
    if (node === null) return;
    if (NAME_NODES.has(node.type))
        addIdentifier(
            sink,
            node,
            category,
            node.type === 'private_property_identifier' ? node.text.slice(1) : node.text,
        );
    else if (PATTERN_FIELDS[node.type] !== undefined)
        addPattern(sink, node.childForFieldName(PATTERN_FIELDS[node.type] ?? ''), category);
    else if (PATTERN_LISTS.has(node.type)) for (const child of node.namedChildren) addPattern(sink, child, category);
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
        if (TYPESCRIPT_PARAMETER_NODES.includes(parameter.type)) addParameter(sink, parameter);
        else addPattern(sink, parameter, 'parameters');
    }
    addPattern(sink, node.childForFieldName('parameter'), 'parameters');
}

// `const { existsSync } = require('node:fs')` and `const { default: X } = await import('x')` bind names another module
// declared. Any other awaited value is a locally declared binding, and its name is checked.
function isImportBinding(node: Node): boolean {
    const value = node.childForFieldName('value');
    if (value === null) return false;
    const awaited = value.type === 'await_expression' ? value.namedChildren[0] : value;
    if (awaited?.type !== 'call_expression') return false;
    const callee = awaited.childForFieldName('function');
    return callee?.type === 'import' || callee?.text === 'require';
}

function addNamed(sink: ExtractSink, root: Node): void {
    for (const [types, category] of NAMED_DECLARATIONS) {
        const nodes = root
            .descendantsOfType(types)
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
 * The identifiers a parsed TypeScript or JavaScript file declares.
 * @param root the tree's root node
 * @param file the file path
 * @param language `typescript` or `javascript`
 * @returns the declarations found in the tree
 */
export function typescriptIdentifiers(root: Node, file: string, language: string): Identifier[] {
    const sink: ExtractSink = { file, language, out: [] };
    addNamed(sink, root);
    addEnumCases(sink, root);
    const declarators = root.descendantsOfType('variable_declarator').filter((node) => !isImportBinding(node));
    for (const node of declarators) addPattern(sink, node.childForFieldName('name'), 'variables');
    const callables = root.descendantsOfType([
        ...TYPESCRIPT_FUNCTION_NODES,
        ...TYPESCRIPT_METHOD_NODES,
        'arrow_function',
    ]);
    for (const node of callables) addParameters(sink, node);
    return sink.out;
}
