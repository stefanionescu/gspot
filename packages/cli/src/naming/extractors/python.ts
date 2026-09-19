// Identifiers a Python file declares, by category, through tree-sitter. Dunder names belong to the language and are left out.
import type { Node } from 'web-tree-sitter';
import type { ExtractSink, Identifier } from '#types/naming.ts';

const PARAMETER_NODES = new Set(['identifier', 'typed_parameter', 'default_parameter', 'typed_default_parameter']);
const SPLAT_NODES = new Set(['list_splat_pattern', 'dictionary_splat_pattern']);
const IMPLICIT_PARAMETERS = new Set(['self', 'cls']);
const DUNDER = /^__\w+__$/u;
const UPPER_SHAPE = /^_?[A-Z][A-Z\d_]*$/u;
const EXCEPTION_BASE = /(?:Error|Exception|Warning)\b/u;
const LABELS: Record<string, string> = {
    classes: 'class',
    exceptions: 'exception',
    functions: 'function',
    methods: 'method',
    parameters: 'parameter',
    variables: 'variable',
    constants: 'constant',
    attributes: 'attribute',
    type_aliases: 'type alias',
};

function add(sink: ExtractSink, node: Node, category: string): void {
    const name = node.text;
    if (name === '' || name === '_' || DUNDER.test(name)) return;
    sink.out.push({
        file: sink.file,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        language: 'python',
        category,
        kind: `python ${LABELS[category] ?? category}`,
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

function isParameter(node: Node): boolean {
    return PARAMETER_NODES.has(node.type) || SPLAT_NODES.has(node.type);
}

function addParameters(sink: ExtractSink, definition: Node): void {
    const parameters = definition.childForFieldName('parameters')?.namedChildren ?? [];
    const names = parameters.filter((parameter) => isParameter(parameter)).map((parameter) => parameterName(parameter));
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
    return holder === 'module' && UPPER_SHAPE.test(name) ? 'constants' : 'variables';
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
