// Identifiers a shell script declares: functions and variables, through tree-sitter.
import type { Node } from 'web-tree-sitter';
import type { ExtractSink, Identifier } from '#cli/types/naming.ts';

function add(sink: ExtractSink, node: Node, category: string): void {
    const name = node.text;
    if (name === '' || name === '_') return;
    const kind = category === 'functions' ? 'bash function' : 'bash variable';
    sink.out.push({
        file: sink.file,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        language: 'bash',
        category,
        kind,
        name,
    });
}

function addFunctions(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('function_definition')) {
        const name = node.childForFieldName('name');
        if (name !== null) add(sink, name, 'functions');
    }
}

function addAssignments(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('variable_assignment')) {
        const name = node.childForFieldName('name');
        if (name?.type === 'variable_name') add(sink, name, 'variables');
    }
}

function addDeclarations(sink: ExtractSink, root: Node): void {
    for (const node of root.descendantsOfType('declaration_command'))
        for (const child of node.namedChildren) if (child.type === 'variable_name') add(sink, child, 'variables');
}

/**
 * The functions and variables a parsed shell script declares.
 * @param root the tree's root node
 * @param file the file path
 * @returns the identifiers in document order
 */
export function bashIdentifiers(root: Node, file: string): Identifier[] {
    const sink: ExtractSink = { file, language: 'bash', out: [] };
    addFunctions(sink, root);
    addAssignments(sink, root);
    addDeclarations(sink, root);
    return sink.out.toSorted((a, b) => a.line - b.line || a.column - b.column);
}
