import type { Node } from 'web-tree-sitter';
import type { NamedCategory } from '#cli/types/settings/tables.ts';
import { addIdentifier } from '#cli/checks/naming/languages/identifier.ts';
import type { Identifier, ExtractSink } from '#cli/types/checks/naming.ts';

import {
    PYTHON_CONSTANT,
    PYTHON_TYPE_NAME,
    PYTHON_TYPE_FORMS,
    PYTHON_SPLAT_NODES,
    PYTHON_EXCEPTION_BASE,
    PYTHON_PARAMETER_NODES,
    PYTHON_IMPLICIT_PARAMETERS,
    PYTHON_TYPE_ALIAS_ANNOTATION,
} from '#cli/config/checks/naming.ts';

// The block that holds a definition: the body of a class, the body of a function, or the module.
function getHolderType(node: Node): string {
    const block = node.parent?.type === 'decorated_definition' ? node.parent.parent : node.parent;
    return block?.type === 'block' ? (block.parent?.type ?? 'module') : 'module';
}

function addClasses(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('class_definition')) {
        const name = node.childForFieldName('name');
        const bases = node.childForFieldName('superclasses')?.text ?? '';
        if (name !== null) addIdentifier(sink, name, PYTHON_EXCEPTION_BASE.test(bases) ? 'exceptions' : 'classes');
    }
}

// The identifier inside a splat such as *verbatim or **flags, or the node itself.
function unwrapSplat(node: Node | null): Node | null {
    if (node === null || !PYTHON_SPLAT_NODES.has(node.type)) return node;
    return node.namedChildren[0] ?? null;
}

function findParameterName(parameter: Node): Node | null {
    if (parameter.type === 'identifier') return parameter;
    const inner = PYTHON_SPLAT_NODES.has(parameter.type) ? parameter : parameter.childForFieldName('name');
    return unwrapSplat(inner ?? parameter.namedChildren[0] ?? null);
}

function addParameters(sink: ExtractSink, definition: Node): void {
    const parameters = definition.childForFieldName('parameters')?.namedChildren ?? [];
    const names = parameters
        .filter((parameter) => PYTHON_PARAMETER_NODES.has(parameter.type) || PYTHON_SPLAT_NODES.has(parameter.type))
        .map((parameter) => findParameterName(parameter));
    for (const name of names)
        if (name?.type === 'identifier' && !PYTHON_IMPLICIT_PARAMETERS.has(name.text))
            addIdentifier(sink, name, 'parameters');
}

function addFunctions(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('function_definition')) {
        addParameters(sink, node);
        const name = node.childForFieldName('name');
        if (name !== null)
            addIdentifier(sink, name, getHolderType(node) === 'class_definition' ? 'methods' : 'functions');
    }
}

function classifyDeclaredName(node: Node, name: string): NamedCategory {
    const holder = getHolderType(node.parent ?? node);
    if (holder === 'class_definition') return 'attributes';
    return holder === 'module' && PYTHON_CONSTANT.test(name) ? 'constants' : 'variables';
}

function isTypeOperand(operand: Node | null): boolean {
    if (operand === null) return false;
    if (operand.type === 'none') return true;
    if (operand.type === 'identifier' || operand.type === 'attribute')
        return PYTHON_TYPE_NAME.test(operand.text.slice(operand.text.lastIndexOf('.') + 1));
    return isTypeForm(operand);
}

function isTypeForm(node: Node | null): boolean {
    if (node === null) return false;
    if (node.type === 'subscript') {
        const value = node.childForFieldName('value');
        return value !== null && PYTHON_TYPE_FORMS.has(value.text.slice(value.text.lastIndexOf('.') + 1));
    }
    if (node.type !== 'binary_operator' || node.childForFieldName('operator')?.text !== '|') return false;
    return isTypeOperand(node.childForFieldName('left')) && isTypeOperand(node.childForFieldName('right'));
}

function isTypeAlias(node: Node): boolean {
    if (getHolderType(node.parent ?? node) !== 'module') return false;
    const annotation = node.childForFieldName('type');
    if (annotation !== null) return PYTHON_TYPE_ALIAS_ANNOTATION.test(annotation.text);
    return isTypeForm(node.childForFieldName('right'));
}

function addAssignment(sink: ExtractSink, node: Node): void {
    const left = node.childForFieldName('left');
    if (left?.type !== 'identifier') return;
    addIdentifier(sink, left, isTypeAlias(node) ? 'type_aliases' : classifyDeclaredName(node, left.text));
}

function addAssignments(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('assignment')) addAssignment(sink, node);
    for (const node of root.descendantsOfType('type_alias_statement')) {
        const left = node.childForFieldName('left') ?? node.namedChildren[0] ?? null;
        if (left !== null) addIdentifier(sink, left, 'type_aliases');
    }
}

/**
 * Lists the names that a Python module declares.
 *
 * @param syntaxRoot the parsed module.
 * @param file the repository path of the module.
 * @returns the declared names.
 */
export function extractPythonIdentifiers(syntaxRoot: Node, file: string): Identifier[] {
    const sink: ExtractSink = { file, language: 'python', out: [] };
    addClasses(sink, syntaxRoot);
    addFunctions(sink, syntaxRoot);
    addAssignments(sink, syntaxRoot);
    return sink.out;
}
