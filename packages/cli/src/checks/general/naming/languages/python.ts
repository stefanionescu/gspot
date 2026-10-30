import type { Node } from 'web-tree-sitter';
import type { NamedCategory } from '#cli/types/settings/naming.ts';
import { addIdentifier } from '#cli/checks/general/naming/languages/identifier.ts';
import type { Identifier, FileIdentifiers } from '#cli/types/checks/general/naming.ts';

import {
    TYPE_NAME,
    TYPE_FORMS,
    SPLAT_NODES,
    CONSTANT_NAME,
    EXCEPTION_BASE,
    PARAMETER_NODES,
    IMPLICIT_PARAMETERS,
    TYPE_ALIAS_ANNOTATION,
} from '#cli/config/checks/general/naming/languages/python.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Three identifier readers in this file find the block that holds a definition through it.
function getHolderType(node: Node): string {
    const block = node.parent?.type === 'decorated_definition' ? node.parent.parent : node.parent;
    return block?.type === 'block' ? (block.parent?.type ?? 'module') : 'module';
}

function addClasses(found: FileIdentifiers, syntaxRoot: Node): void {
    for (const node of syntaxRoot.descendantsOfType('class_definition')) {
        const name = node.childForFieldName('name');
        const bases = node.childForFieldName('superclasses')?.text ?? '';
        if (name !== null) addIdentifier(found, name, EXCEPTION_BASE.test(bases) ? 'exceptions' : 'classes');
    }
}

function findParameterName(parameter: Node): Node | null {
    if (parameter.type === 'identifier') return parameter;
    const inner = SPLAT_NODES.has(parameter.type) ? parameter : parameter.childForFieldName('name');
    const node = inner ?? parameter.namedChildren[0] ?? null;
    return node === null || !SPLAT_NODES.has(node.type) ? node : (node.namedChildren[0] ?? null);
}

function addParameters(found: FileIdentifiers, definition: Node): void {
    const parameters = definition.childForFieldName('parameters')?.namedChildren ?? [];
    const names = parameters
        .filter((parameter) => PARAMETER_NODES.has(parameter.type) || SPLAT_NODES.has(parameter.type))
        .map((parameter) => findParameterName(parameter));
    for (const name of names)
        if (name?.type === 'identifier' && !IMPLICIT_PARAMETERS.has(name.text))
            addIdentifier(found, name, 'parameters');
}

function addFunctions(found: FileIdentifiers, syntaxRoot: Node): void {
    for (const node of syntaxRoot.descendantsOfType('function_definition')) {
        addParameters(found, node);
        const name = node.childForFieldName('name');
        if (name !== null)
            addIdentifier(found, name, getHolderType(node) === 'class_definition' ? 'methods' : 'functions');
    }
}

function classifyName(node: Node, name: string): NamedCategory {
    const holder = getHolderType(node.parent ?? node);
    if (holder === 'class_definition') return 'attributes';
    return holder === 'module' && CONSTANT_NAME.test(name) ? 'constants' : 'variables';
}

function isTypeOperand(operand: Node | null): boolean {
    if (operand === null) return false;
    if (operand.type === 'none') return true;
    return operand.type === 'identifier' || operand.type === 'attribute'
        ? TYPE_NAME.test(operand.text.slice(operand.text.lastIndexOf('.') + 1))
        : isTypeForm(operand);
}

function isTypeForm(node: Node | null): boolean {
    if (node === null) return false;
    if (node.type === 'subscript') {
        const value = node.childForFieldName('value');
        return value !== null && TYPE_FORMS.has(value.text.slice(value.text.lastIndexOf('.') + 1));
    }
    return (
        node.type === 'binary_operator' &&
        node.childForFieldName('operator')?.text === '|' &&
        isTypeOperand(node.childForFieldName('left')) &&
        isTypeOperand(node.childForFieldName('right'))
    );
}

function isTypeAlias(node: Node): boolean {
    const holder = getHolderType(node.parent ?? node);
    if (holder !== 'module') return false;
    const annotation = node.childForFieldName('type');
    return annotation === null
        ? isTypeForm(node.childForFieldName('right'))
        : TYPE_ALIAS_ANNOTATION.test(annotation.text);
}

function addAssignment(found: FileIdentifiers, node: Node): void {
    const left = node.childForFieldName('left');
    if (left?.type !== 'identifier') return;
    addIdentifier(found, left, isTypeAlias(node) ? 'type_aliases' : classifyName(node, left.text));
}

function addAssignments(found: FileIdentifiers, syntaxRoot: Node): void {
    for (const node of syntaxRoot.descendantsOfType('assignment')) addAssignment(found, node);
    for (const node of syntaxRoot.descendantsOfType('type_alias_statement')) {
        const left = node.childForFieldName('left') ?? node.namedChildren[0] ?? null;
        if (left !== null) addIdentifier(found, left, 'type_aliases');
    }
}

/**
Lists the names that a Python module declares.

@param syntaxRoot the parsed module.
@param file the repository path of the module.
*/
export function extractPythonIdentifiers(syntaxRoot: Node, file: string): Identifier[] {
    const found: FileIdentifiers = { file, language: 'python', identifiers: [] };
    addClasses(found, syntaxRoot);
    addFunctions(found, syntaxRoot);
    addAssignments(found, syntaxRoot);
    return found.identifiers;
}
