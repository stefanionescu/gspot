import type { Node } from 'web-tree-sitter';
import { addIdentifier } from '#cli/parsers/naming/identifiers.ts';
import type { Identifier, ExtractSink } from '#cli/types/parsers/naming.ts';

import {
    SPLAT_NODES,
    EXCEPTION_BASE,
    PYTHON_CONSTANT,
    IMPLICIT_PARAMETERS,
    PYTHON_PARAMETER_NODES,
} from '#cli/config/parsers/naming.ts';

// The block that holds a definition: the body of a class, the body of a function, or the module.

function holderOf(node: Node): string {
    const block = node.parent?.type === 'decorated_definition' ? node.parent.parent : node.parent;
    return block?.type === 'block' ? (block.parent?.type ?? 'module') : 'module';
}

function addClasses(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('class_definition')) {
        const name = node.childForFieldName('name');
        const bases = node.childForFieldName('superclasses')?.text ?? '';
        if (name !== null) addIdentifier(sink, name, EXCEPTION_BASE.test(bases) ? 'exceptions' : 'classes');
    }
}

// The identifier inside a splat such as *verbatim or **flags, or the node itself.
function unwrapped(node: Node | null): Node | null {
    if (node === null || !SPLAT_NODES.has(node.type)) return node;
    return node.namedChildren[0] ?? null;
}

function parameterName(parameter: Node): Node | null {
    if (parameter.type === 'identifier') return parameter;
    const inner = SPLAT_NODES.has(parameter.type) ? parameter : parameter.childForFieldName('name');
    return unwrapped(inner ?? parameter.namedChildren[0] ?? null);
}

function addParameters(sink: ExtractSink, definition: Node): void {
    const parameters = definition.childForFieldName('parameters')?.namedChildren ?? [];
    const names = parameters
        .filter((parameter) => PYTHON_PARAMETER_NODES.has(parameter.type) || SPLAT_NODES.has(parameter.type))
        .map((parameter) => parameterName(parameter));
    for (const name of names)
        if (name?.type === 'identifier' && !IMPLICIT_PARAMETERS.has(name.text)) addIdentifier(sink, name, 'parameters');
}

function addFunctions(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('function_definition')) {
        addParameters(sink, node);
        const name = node.childForFieldName('name');
        if (name !== null) addIdentifier(sink, name, holderOf(node) === 'class_definition' ? 'methods' : 'functions');
    }
}

function bindingCategory(node: Node, name: string): string {
    const holder = holderOf(node.parent ?? node);
    if (holder === 'class_definition') return 'attributes';
    return holder === 'module' && PYTHON_CONSTANT.test(name) ? 'constants' : 'variables';
}

function addAssignments(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('assignment')) {
        const left = node.childForFieldName('left');
        if (left?.type !== 'identifier') continue;
        addIdentifier(sink, left, bindingCategory(node, left.text));
    }
    for (const node of root.descendantsOfType('type_alias_statement')) {
        const left = node.childForFieldName('left') ?? node.namedChildren[0] ?? null;
        if (left !== null) addIdentifier(sink, left, 'type_aliases');
    }
}

/**
 * The classes, exceptions, functions, methods, parameters, bindings and type aliases a parsed Python file declares.
 * @param root the root node
 * @param file the file path
 * @returns the identifiers
 */
export function pythonIdentifiers(root: Node, file: string): Identifier[] {
    const sink: ExtractSink = { file, language: 'python', out: [] };
    addClasses(sink, root);
    addFunctions(sink, root);
    addAssignments(sink, root);
    return sink.out;
}
