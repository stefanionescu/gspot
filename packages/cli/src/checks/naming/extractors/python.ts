import type { Node } from 'web-tree-sitter';
import type { ExtractSink, Identifier } from '#cli/types/checks/naming.ts';

import {
    DUNDER,
    EXCEPTION_BASE,
    IMPLICIT_PARAMETERS,
    PYTHON_LABELS,
    PYTHON_PARAMETER_NODES,
    PYTHON_UPPER_SHAPE,
    SPLAT_NODES,
} from '#cli/constants/checks/naming.ts';

function add(sink: ExtractSink, node: Node, category: string): void {
    const name = node.text;
    if (name === '' || name === '_' || DUNDER.test(name)) return;
    sink.out.push({
        file: sink.file,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        language: 'python',
        category,
        kind: `python ${PYTHON_LABELS[category] ?? category}`,
        name,
    });
}

// The block that holds a definition: the body of a class, the body of a function, or the module.
function holderOf(node: Node): string {
    const block = node.parent?.type === 'decorated_definition' ? node.parent.parent : node.parent;
    return block?.type === 'block' ? (block.parent?.type ?? 'module') : 'module';
}

function addClasses(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('class_definition')) {
        const name = node.childForFieldName('name');
        const bases = node.childForFieldName('superclasses')?.text ?? '';
        if (name !== null) add(sink, name, EXCEPTION_BASE.test(bases) ? 'exceptions' : 'classes');
    }
}

// The identifier inside a splat such as *extra or **flags, or the node itself.
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
        if (name?.type === 'identifier' && !IMPLICIT_PARAMETERS.has(name.text)) add(sink, name, 'parameters');
}

function addFunctions(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('function_definition')) {
        addParameters(sink, node);
        const name = node.childForFieldName('name');
        if (name !== null) add(sink, name, holderOf(node) === 'class_definition' ? 'methods' : 'functions');
    }
}

function bindingCategory(node: Node, name: string): string {
    const holder = holderOf(node.parent ?? node);
    if (holder === 'class_definition') return 'attributes';
    return holder === 'module' && PYTHON_UPPER_SHAPE.test(name) ? 'constants' : 'variables';
}

function addAssignments(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('assignment')) {
        const left = node.childForFieldName('left');
        if (left?.type !== 'identifier') continue;
        add(sink, left, bindingCategory(node, left.text));
    }
    for (const node of root.descendantsOfType('type_alias_statement')) {
        const left = node.childForFieldName('left') ?? node.namedChildren[0] ?? null;
        if (left !== null) add(sink, left, 'type_aliases');
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
