// Identifiers a Swift file declares, by category, through tree-sitter. An extension declares no type of its own.
import type { Node } from 'web-tree-sitter';
import type { ExtractSink, Identifier } from '#cli/naming/types.ts';

const TYPE_NODES = ['class_declaration', 'protocol_declaration', 'typealias_declaration'];
const FUNCTION_NODES = ['function_declaration', 'protocol_function_declaration'];
const MEMBER_PARENTS = new Set(['class_body', 'protocol_body', 'enum_class_body']);
const LABELS: Record<string, string> = {
    types: 'type',
    functions: 'function',
    methods: 'method',
    parameters: 'parameter',
    properties: 'property',
    constants: 'constant',
    variables: 'variable',
    enum_cases: 'enum case',
};

function add(sink: ExtractSink, node: Node, category: string): void {
    const name = node.text.replaceAll('`', '');
    if (name === '' || name === '_') return;
    sink.out.push({
        file: sink.file,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        language: 'swift',
        category,
        kind: `swift ${LABELS[category] ?? category}`,
        name,
    });
}

function addTypes(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType(TYPE_NODES)) {
        const name = node.childForFieldName('name');
        if (name?.type === 'type_identifier') add(sink, name, 'types');
    }
}

// A parameter holds the name callers write and the name the body reads; the body's name is the declaration.
function addParameters(sink: ExtractSink, owner: Node): void {
    for (const parameter of owner.namedChildren) {
        if (parameter.type !== 'parameter') continue;
        const name = parameter.childrenForFieldName('name').find((child) => child.type === 'simple_identifier');
        const local = name;
        if (local) add(sink, local, 'parameters');
    }
}

function addFunctions(sink: ExtractSink, root: Node): void {
    const declarations = root.descendantsOfType([...FUNCTION_NODES, 'init_declaration']);
    for (const node of declarations) {
        addParameters(sink, node);
        const name = node.childForFieldName('name');
        if (name?.type !== 'simple_identifier') continue;
        add(sink, name, MEMBER_PARENTS.has(node.parent?.type ?? '') ? 'methods' : 'functions');
    }
}

function bindingCategory(node: Node): string {
    const parent = node.parent?.type ?? '';
    if (MEMBER_PARENTS.has(parent)) return 'properties';
    const isConstant = node.namedChildren.some(
        (child) => child.type === 'value_binding_pattern' && child.text === 'let',
    );
    return parent === 'source_file' && isConstant ? 'constants' : 'variables';
}

function addBindings(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('property_declaration')) {
        const category = bindingCategory(node);
        for (const pattern of node.childrenForFieldName('name')) {
            const bound = pattern.childForFieldName('bound_identifier');
            if (bound) add(sink, bound, category);
        }
    }
}

function addCases(sink: ExtractSink, root: Node): void {
    for (const entry of root.descendantsOfType('enum_entry'))
        for (const name of entry.childrenForFieldName('name'))
            if (name.type === 'simple_identifier') add(sink, name, 'enum_cases');
}

/**
 * The types, functions, methods, parameters, properties, bindings and enum cases a parsed Swift file declares.
 * @param root the root node
 * @param file the file path
 * @returns the identifiers
 */
export function swiftIdentifiers(root: Node, file: string): Identifier[] {
    const sink: ExtractSink = { file, language: 'swift', out: [] };
    addTypes(sink, root);
    addFunctions(sink, root);
    addBindings(sink, root);
    addCases(sink, root);
    return sink.out;
}
