import type { Node } from 'web-tree-sitter';
import { addIdentifier } from '#cli/parsers/naming/contracts.ts';
import type { Identifier, ExtractSink } from '#cli/types/parsers/naming.ts';
import { MEMBER_PARENTS, SWIFT_TYPE_NODES, SWIFT_FUNCTION_NODES } from '#cli/config/parsers/naming.ts';

function addTypes(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType(SWIFT_TYPE_NODES)) {
        const name = node.childForFieldName('name');
        if (name?.type === 'type_identifier') addIdentifier(sink, name, 'types', name.text.replaceAll('`', ''));
    }
}

// A parameter holds the name callers write and the name the body reads; the body's name is the declaration.
function addParameters(sink: ExtractSink, owner: Node): void {
    for (const parameter of owner.namedChildren) {
        if (parameter.type !== 'parameter') continue;
        const name = parameter.childrenForFieldName('name').find((child) => child.type === 'simple_identifier');
        if (name) addIdentifier(sink, name, 'parameters', name.text.replaceAll('`', ''));
    }
}

function addFunctions(sink: ExtractSink, root: Node): void {
    const declarations = root.descendantsOfType([...SWIFT_FUNCTION_NODES, 'init_declaration']);
    for (const node of declarations) {
        addParameters(sink, node);
        const name = node.childForFieldName('name');
        if (name?.type !== 'simple_identifier') continue;
        addIdentifier(
            sink,
            name,
            MEMBER_PARENTS.has(node.parent?.type ?? '') ? 'methods' : 'functions',
            name.text.replaceAll('`', ''),
        );
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

function addNames(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('property_declaration')) {
        const category = bindingCategory(node);
        for (const pattern of node.childrenForFieldName('name')) {
            const bound = pattern.childForFieldName('bound_identifier');
            if (bound) addIdentifier(sink, bound, category, bound.text.replaceAll('`', ''));
        }
    }
}

function addCases(sink: ExtractSink, root: Node): void {
    for (const entry of root.descendantsOfType('enum_entry'))
        for (const name of entry.childrenForFieldName('name'))
            if (name.type === 'simple_identifier')
                addIdentifier(sink, name, 'enum_cases', name.text.replaceAll('`', ''));
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
    addNames(sink, root);
    addCases(sink, root);
    return sink.out;
}
