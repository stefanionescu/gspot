import type { Node } from 'web-tree-sitter';
import type { NamedCategory } from '#cli/types/settings/naming.ts';
import { addIdentifier } from '#cli/checks/general/naming/languages/identifier.ts';
import type { Identifier, FileIdentifiers } from '#cli/types/checks/general/naming.ts';

import {
    SWIFT_NAME_QUOTE,
    SWIFT_TYPE_NODES,
    SWIFT_MEMBER_PARENTS,
    SWIFT_CALLABLE_NODES,
} from '#cli/config/checks/general/naming/languages/swift.ts';

function addTypes(found: FileIdentifiers, root: Node): void {
    for (const node of root.descendantsOfType([...SWIFT_TYPE_NODES])) {
        const name = node.childForFieldName('name');
        if (name?.type === 'type_identifier')
            addIdentifier(found, name, 'types', name.text.replaceAll(SWIFT_NAME_QUOTE, ''));
    }
}

function addParameters(found: FileIdentifiers, declaration: Node): void {
    for (const parameter of declaration.namedChildren) {
        if (parameter.type !== 'parameter') continue;
        const name = parameter.childrenForFieldName('name').find((child) => child.type === 'simple_identifier');
        if (name) addIdentifier(found, name, 'parameters', name.text.replaceAll(SWIFT_NAME_QUOTE, ''));
    }
}

function addFunctions(found: FileIdentifiers, root: Node): void {
    const declarations = root.descendantsOfType([...SWIFT_CALLABLE_NODES]);
    for (const node of declarations) {
        addParameters(found, node);
        const name = node.childForFieldName('name');
        if (name?.type !== 'simple_identifier') continue;
        addIdentifier(
            found,
            name,
            SWIFT_MEMBER_PARENTS.has(node.parent?.type ?? '') ? 'methods' : 'functions',
            name.text.replaceAll(SWIFT_NAME_QUOTE, ''),
        );
    }
}

function classifyName(node: Node): NamedCategory {
    const parent = node.parent?.type ?? '';
    if (SWIFT_MEMBER_PARENTS.has(parent)) return 'properties';
    const isConstant = node.namedChildren.some(
        (child) => child.type === 'value_binding_pattern' && child.text === 'let',
    );
    return parent === 'source_file' && isConstant ? 'constants' : 'variables';
}

function addNames(found: FileIdentifiers, root: Node): void {
    for (const node of root.descendantsOfType('property_declaration')) {
        const category = classifyName(node);
        for (const pattern of node.childrenForFieldName('name')) {
            const bound = pattern.childForFieldName('bound_identifier');
            if (bound) addIdentifier(found, bound, category, bound.text.replaceAll(SWIFT_NAME_QUOTE, ''));
        }
    }
}

function addCases(found: FileIdentifiers, root: Node): void {
    for (const enumCase of root.descendantsOfType('enum_entry'))
        for (const name of enumCase.childrenForFieldName('name'))
            if (name.type === 'simple_identifier')
                addIdentifier(found, name, 'enum_cases', name.text.replaceAll(SWIFT_NAME_QUOTE, ''));
}

/**
 * Lists the names that a Swift file declares.
 *
 * @param syntaxRoot the parsed file.
 * @param file the repository path of the source.
 * @returns the declared names.
 */
export function extractSwiftIdentifiers(syntaxRoot: Node, file: string): Identifier[] {
    const found: FileIdentifiers = { file, language: 'swift', out: [] };
    addTypes(found, syntaxRoot);
    addFunctions(found, syntaxRoot);
    addNames(found, syntaxRoot);
    addCases(found, syntaxRoot);
    return found.out;
}
