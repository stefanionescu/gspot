import type { Node } from 'web-tree-sitter';

import { TYPE_NODES } from '#cli/config/configurations/general.ts';
import {
    MEMBER_PARENTS,
    OBJC_ATTRIBUTE,
    OBJC_CALLBACK_PREFIX,
    SWIFT_CALLABLE_NODES,
} from '#cli/config/configurations/naming.ts';
import { addIdentifier } from '#cli/configurations/general/naming/checks/languages/identifier.ts';
import type { FileIdentifiers, Identifier, NamedCategory } from '#cli/types/configurations/general.ts';

function addTypes(found: FileIdentifiers, syntaxRoot: Node): void {
    const declarations = syntaxRoot.descendantsOfType([...TYPE_NODES]);
    for (const node of declarations) {
        const name = node.childForFieldName('name');
        if (name?.type === 'type_identifier') addIdentifier(found, name, 'types');
    }
}

function addParameters(found: FileIdentifiers, declaration: Node): void {
    for (const parameter of declaration.namedChildren) {
        if (parameter.type !== 'parameter') continue;
        const name = parameter.childrenForFieldName('name').find((child) => child.type === 'simple_identifier');
        if (name) addIdentifier(found, name, 'parameters');
    }
}

function addFunctions(found: FileIdentifiers, syntaxRoot: Node): void {
    const declarations = syntaxRoot.descendantsOfType([...SWIFT_CALLABLE_NODES]);
    for (const node of declarations) {
        addParameters(found, node);
        const name = node.childForFieldName('name');
        if (name?.type === 'simple_identifier') addFunctionName(found, node, name);
    }
}

function addFunctionName(found: FileIdentifiers, declaration: Node, name: Node): void {
    const start = found.identifiers.length;
    addIdentifier(found, name, MEMBER_PARENTS.has(declaration.parent?.type ?? '') ? 'methods' : 'functions');
    if (isObjcDeclaration(declaration))
        for (const identifier of found.identifiers.slice(start)) identifier.ignoredPrefix = OBJC_CALLBACK_PREFIX;
}

function isObjcDeclaration(declaration: Node): boolean {
    return declaration.namedChildren.some(
        (child) =>
            child.type === 'modifiers' &&
            child.namedChildren.some(
                (modifier) => modifier.type === 'attribute' && modifier.namedChildren[0]?.text === OBJC_ATTRIBUTE,
            ),
    );
}

function classifyName(node: Node): NamedCategory {
    const parent = node.parent?.type ?? '';
    if (MEMBER_PARENTS.has(parent)) return 'properties';
    const isConstant = node.namedChildren.some(
        (child) => child.type === 'value_binding_pattern' && child.text === 'let',
    );
    return parent === 'source_file' && isConstant ? 'constants' : 'variables';
}

function addNames(found: FileIdentifiers, syntaxRoot: Node): void {
    for (const node of syntaxRoot.descendantsOfType('property_declaration')) {
        const category = classifyName(node);
        for (const pattern of node.childrenForFieldName('name')) {
            const bound = pattern.childForFieldName('bound_identifier');
            if (bound) addIdentifier(found, bound, category);
        }
    }
}

function addCases(found: FileIdentifiers, syntaxRoot: Node): void {
    for (const enumCase of syntaxRoot.descendantsOfType('enum_entry'))
        for (const name of enumCase.childrenForFieldName('name'))
            if (name.type === 'simple_identifier') addIdentifier(found, name, 'enum_cases');
}

export function extractSwiftIdentifiers(syntaxRoot: Node, file: string): Identifier[] {
    const found: FileIdentifiers = { file, language: 'swift', identifiers: [] };
    addTypes(found, syntaxRoot);
    addFunctions(found, syntaxRoot);
    addNames(found, syntaxRoot);
    addCases(found, syntaxRoot);
    return found.identifiers;
}
