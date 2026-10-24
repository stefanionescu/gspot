import type { Node } from 'web-tree-sitter';
import type { NamedCategory } from '#cli/types/settings/naming.ts';
import { addIdentifier } from '#cli/checks/general/naming/languages/identifier.ts';
import type { Identifier, FileIdentifiers } from '#cli/types/checks/general/naming.ts';

import {
    PYTHON_CONSTANT,
    PYTHON_TYPE_NAME,
    PYTHON_TYPE_FORMS,
    PYTHON_SPLAT_NODES,
    PYTHON_EXCEPTION_BASE,
    PYTHON_PARAMETER_NODES,
    PYTHON_IMPLICIT_PARAMETERS,
    PYTHON_TYPE_ALIAS_ANNOTATION,
} from '#cli/config/checks/general/naming/languages/python.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 3 calls in this file share it.
function getHolderType(node: Node): string {
    const block = node.parent?.type === 'decorated_definition' ? node.parent.parent : node.parent;
    return block?.type === 'block' ? (block.parent?.type ?? 'module') : 'module';
}

function addClasses(found: FileIdentifiers, root: Node): void {
    for (const node of root.descendantsOfType('class_definition')) {
        const name = node.childForFieldName('name');
        const bases = node.childForFieldName('superclasses')?.text ?? '';
        if (name !== null) addIdentifier(found, name, PYTHON_EXCEPTION_BASE.test(bases) ? 'exceptions' : 'classes');
    }
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function unwrapSplat(node: Node | null): Node | null {
    return node === null || !PYTHON_SPLAT_NODES.has(node.type) ? node : (node.namedChildren[0] ?? null);
}

function findParameterName(parameter: Node): Node | null {
    if (parameter.type === 'identifier') return parameter;
    const inner = PYTHON_SPLAT_NODES.has(parameter.type) ? parameter : parameter.childForFieldName('name');
    return unwrapSplat(inner ?? parameter.namedChildren[0] ?? null);
}

function addParameters(found: FileIdentifiers, definition: Node): void {
    const parameters = definition.childForFieldName('parameters')?.namedChildren ?? [];
    const names = parameters
        .filter((parameter) => PYTHON_PARAMETER_NODES.has(parameter.type) || PYTHON_SPLAT_NODES.has(parameter.type))
        .map((parameter) => findParameterName(parameter));
    for (const name of names)
        if (name?.type === 'identifier' && !PYTHON_IMPLICIT_PARAMETERS.has(name.text))
            addIdentifier(found, name, 'parameters');
}

function addFunctions(found: FileIdentifiers, root: Node): void {
    for (const node of root.descendantsOfType('function_definition')) {
        addParameters(found, node);
        const name = node.childForFieldName('name');
        if (name !== null)
            addIdentifier(found, name, getHolderType(node) === 'class_definition' ? 'methods' : 'functions');
    }
}

function classifyName(node: Node, name: string): NamedCategory {
    const holder = getHolderType(node.parent ?? node);
    if (holder === 'class_definition') return 'attributes';
    return holder === 'module' && PYTHON_CONSTANT.test(name) ? 'constants' : 'variables';
}

function isTypeOperand(operand: Node | null): boolean {
    if (operand === null) return false;
    if (operand.type === 'none') return true;
    return operand.type === 'identifier' || operand.type === 'attribute'
        ? PYTHON_TYPE_NAME.test(operand.text.slice(operand.text.lastIndexOf('.') + 1))
        : isTypeForm(operand);
}

function isTypeForm(node: Node | null): boolean {
    if (node === null) return false;
    if (node.type === 'subscript') {
        const value = node.childForFieldName('value');
        return value !== null && PYTHON_TYPE_FORMS.has(value.text.slice(value.text.lastIndexOf('.') + 1));
    }
    return (
        node.type === 'binary_operator' &&
        node.childForFieldName('operator')?.text === '|' &&
        isTypeOperand(node.childForFieldName('left')) &&
        isTypeOperand(node.childForFieldName('right'))
    );
}

function isTypeAlias(node: Node): boolean {
    if (getHolderType(node.parent ?? node) !== 'module') return false;
    const annotation = node.childForFieldName('type');
    return annotation === null
        ? isTypeForm(node.childForFieldName('right'))
        : PYTHON_TYPE_ALIAS_ANNOTATION.test(annotation.text);
}

function addAssignment(found: FileIdentifiers, node: Node): void {
    const left = node.childForFieldName('left');
    if (left?.type !== 'identifier') return;
    addIdentifier(found, left, isTypeAlias(node) ? 'type_aliases' : classifyName(node, left.text));
}

function addAssignments(found: FileIdentifiers, root: Node): void {
    for (const node of root.descendantsOfType('assignment')) addAssignment(found, node);
    for (const node of root.descendantsOfType('type_alias_statement')) {
        const left = node.childForFieldName('left') ?? node.namedChildren[0] ?? null;
        if (left !== null) addIdentifier(found, left, 'type_aliases');
    }
}

/**
Lists the names that a Python module declares.

@param syntaxRoot the parsed module.
@param file the repository path of the module.
@returns the declared names.
*/
export function extractPythonIdentifiers(syntaxRoot: Node, file: string): Identifier[] {
    const found: FileIdentifiers = { file, language: 'python', out: [] };
    addClasses(found, syntaxRoot);
    addFunctions(found, syntaxRoot);
    addAssignments(found, syntaxRoot);
    return found.out;
}
