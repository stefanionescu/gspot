import type { Node } from 'web-tree-sitter';

import {
    CONSTANT_NAME,
    EXCEPTION_BASE,
    IMPLICIT_PARAMETERS,
    PYTHON_PARAMETER_NODES,
    SPLAT_NODES,
    TYPE_ALIAS_ANNOTATION,
    TYPE_FORMS,
    TYPE_NAME,
} from '#cli/config/configurations/naming.ts';
import { addIdentifier } from '#cli/configurations/general/naming/checks/languages/identifier.ts';
import type { FileIdentifiers, Identifier, NamedCategory } from '#cli/types/configurations/general.ts';

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
        .filter((parameter) => PYTHON_PARAMETER_NODES.has(parameter.type) || SPLAT_NODES.has(parameter.type))
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

export function extractPythonIdentifiers(syntaxRoot: Node, file: string): Identifier[] {
    const found: FileIdentifiers = { file, language: 'python', identifiers: [] };
    addClasses(found, syntaxRoot);
    addFunctions(found, syntaxRoot);
    addAssignments(found, syntaxRoot);
    return found.identifiers;
}
