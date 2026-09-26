import type { Node } from 'web-tree-sitter';
import type { ExtractSink, Identifier } from '#cli/types/checks/naming.ts';

const FUNCTION_NODES = ['function_declaration', 'generator_function_declaration', 'function_expression'];
const METHOD_NODES = ['method_definition', 'method_signature', 'abstract_method_signature'];
const PARAMETER_NODES = ['required_parameter', 'optional_parameter'];
const NAMED_DECLARATIONS: [string[], string][] = [
    [FUNCTION_NODES, 'functions'],
    [METHOD_NODES, 'methods'],
    [['class_declaration', 'abstract_class_declaration'], 'classes'],
    [['interface_declaration', 'type_alias_declaration', 'enum_declaration'], 'types'],
    [['public_field_definition', 'property_signature'], 'properties'],
    [['enum_assignment'], 'enum_cases'],
];
const NAME_NODES = new Set([
    'identifier',
    'property_identifier',
    'private_property_identifier',
    'type_identifier',
    'shorthand_property_identifier_pattern',
]);
const PATTERN_FIELDS: Record<string, string> = {
    pair_pattern: 'value',
    object_assignment_pattern: 'left',
    assignment_pattern: 'left',
};
const PATTERN_LISTS = new Set(['rest_pattern', 'object_pattern', 'array_pattern']);
const UPPER_SHAPE = /^[A-Z][A-Z0-9_]*$/u;
const SNAKE_SHAPE = /^[a-z][a-z0-9_]*$/u;
const LABELS: Record<string, string> = {
    functions: 'function',
    methods: 'method',
    classes: 'class',
    types: 'type',
    properties: 'property',
    enum_cases: 'enum case',
    parameters: 'parameter',
    variables: 'variable',
};

function add(sink: ExtractSink, node: Node | null, category: string): void {
    if (node === null || !NAME_NODES.has(node.type)) return;
    const name = node.type === 'private_property_identifier' ? node.text.slice(1) : node.text;
    if (name === '' || name === '_') return;
    const kind = `${sink.language} ${LABELS[category] ?? category}`;
    sink.out.push({
        file: sink.file,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        language: sink.language,
        category,
        kind,
        name,
    });
}

function addPattern(sink: ExtractSink, node: Node | null, category: string): void {
    if (node === null) return;
    if (NAME_NODES.has(node.type)) add(sink, node, category);
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
    const parameters = node
        .descendantsOfType(PARAMETER_NODES)
        .filter((parameter) => parameter.parent?.parent?.id === node.id);
    for (const parameter of parameters) addParameter(sink, parameter);
    addPattern(sink, node.childForFieldName('parameter'), 'parameters');
}

// A property signature written in snake_case or UPPER_SNAKE describes a shape another format fixes: TOML keys, a JSON API.
function isContractSignature(node: Node): boolean {
    const name = node.childForFieldName('name')?.text ?? '';
    return (
        node.type === 'property_signature' && (UPPER_SHAPE.test(name) || (SNAKE_SHAPE.test(name) && name.includes('_')))
    );
}

// `const { existsSync } = require('node:fs')` and `const { default: X } = await import('x')` bind names another module
// declared. Any other awaited value is a binding of this module, and its name is checked (K-137).
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
                    ) && !isContractSignature(node),
            );
        for (const node of nodes) add(sink, node.childForFieldName('name'), category);
    }
}

function addEnumCases(sink: ExtractSink, root: Node): void {
    for (const body of root.descendantsOfType('enum_body')) {
        const cases = body.namedChildren.filter((child) => child.type === 'property_identifier');
        for (const child of cases) add(sink, child, 'enum_cases');
    }
}

/**
 * The identifiers a parsed TypeScript or JavaScript file declares.
 * @param root the tree's root node
 * @param file the file path
 * @param language `typescript` or `javascript`
 * @returns the identifiers in document order
 */
export function typescriptIdentifiers(root: Node, file: string, language: string): Identifier[] {
    const sink: ExtractSink = { file, language, out: [] };
    addNamed(sink, root);
    addEnumCases(sink, root);
    const declarators = root.descendantsOfType('variable_declarator').filter((node) => !isImportBinding(node));
    for (const node of declarators) addPattern(sink, node.childForFieldName('name'), 'variables');
    const callables = root.descendantsOfType([...FUNCTION_NODES, ...METHOD_NODES, 'arrow_function']);
    for (const node of callables) addParameters(sink, node);
    return sink.out.toSorted((a, b) => a.line - b.line || a.column - b.column);
}
