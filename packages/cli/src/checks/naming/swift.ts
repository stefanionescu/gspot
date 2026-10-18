import type { Node } from 'web-tree-sitter';
import { addIdentifier } from '#cli/checks/naming/collect.ts';
import type { Identifier, ExtractSink, NamedCategory } from '#cli/types/checks/general.ts';

import {
    SWIFT_NAME_QUOTE,
    SWIFT_TYPE_NODES,
    SWIFT_CALLABLE_NODES,
    SWIFT_MEMBER_PARENTS,
} from '#cli/config/checks/general/naming.ts';

function addTypes(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType([...SWIFT_TYPE_NODES])) {
        const name = node.childForFieldName('name');
        if (name?.type === 'type_identifier')
            addIdentifier(sink, name, 'types', name.text.replaceAll(SWIFT_NAME_QUOTE, ''));
    }
}

// A parameter holds the name callers write and the name the body reads; the body's name supplies the declaration.
function addParameters(sink: ExtractSink, declaration: Node): void {
    for (const parameter of declaration.namedChildren) {
        if (parameter.type !== 'parameter') continue;
        const name = parameter.childrenForFieldName('name').find((child) => child.type === 'simple_identifier');
        if (name) addIdentifier(sink, name, 'parameters', name.text.replaceAll(SWIFT_NAME_QUOTE, ''));
    }
}

function addFunctions(sink: ExtractSink, root: Node): void {
    const declarations = root.descendantsOfType([...SWIFT_CALLABLE_NODES]);
    for (const node of declarations) {
        addParameters(sink, node);
        const name = node.childForFieldName('name');
        if (name?.type !== 'simple_identifier') continue;
        addIdentifier(
            sink,
            name,
            SWIFT_MEMBER_PARENTS.has(node.parent?.type ?? '') ? 'methods' : 'functions',
            name.text.replaceAll(SWIFT_NAME_QUOTE, ''),
        );
    }
}

function classifyDeclaredName(node: Node): NamedCategory {
    const parent = node.parent?.type ?? '';
    if (SWIFT_MEMBER_PARENTS.has(parent)) return 'properties';
    const isConstant = node.namedChildren.some(
        (child) => child.type === 'value_binding_pattern' && child.text === 'let',
    );
    return parent === 'source_file' && isConstant ? 'constants' : 'variables';
}

function addNames(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('property_declaration')) {
        const category = classifyDeclaredName(node);
        for (const pattern of node.childrenForFieldName('name')) {
            const bound = pattern.childForFieldName('bound_identifier');
            if (bound) addIdentifier(sink, bound, category, bound.text.replaceAll(SWIFT_NAME_QUOTE, ''));
        }
    }
}

function addCases(sink: ExtractSink, root: Node): void {
    for (const entry of root.descendantsOfType('enum_entry'))
        for (const name of entry.childrenForFieldName('name'))
            if (name.type === 'simple_identifier')
                addIdentifier(sink, name, 'enum_cases', name.text.replaceAll(SWIFT_NAME_QUOTE, ''));
}

/**
 * Lists the names that a Swift file declares.
 * @param syntaxRoot the parsed file.
 * @param file the repository path of the source.
 * @returns the declared names.
 */
export function extractSwiftIdentifiers(syntaxRoot: Node, file: string): Identifier[] {
    const sink: ExtractSink = { file, language: 'swift', out: [] };
    addTypes(sink, syntaxRoot);
    addFunctions(sink, syntaxRoot);
    addNames(sink, syntaxRoot);
    addCases(sink, syntaxRoot);
    return sink.out;
}
