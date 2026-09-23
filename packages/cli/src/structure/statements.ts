import type { Node } from 'web-tree-sitter';

const FUNCTIONS = new Set([
    'function_definition',
    'function_declaration',
    'init_declaration',
    'deinit_declaration',
    'lambda',
    'lambda_literal',
    'computed_getter',
    'computed_setter',
    'computed_property',
    'willset_clause',
    'didset_clause',
]);

/** Count executable statements, excluding nested function bodies and type-only declarations. */
export function executableStatements(nodes: Node[], language: 'python' | 'swift' | 'bash'): number {
    let count = 0;
    for (const node of nodes) {
        if (
            node.type.includes('comment') ||
            node.type === 'type_alias_statement' ||
            node.type === 'typealias_declaration'
        )
            continue;
        if (FUNCTIONS.has(node.type)) {
            if (!node.type.startsWith('lambda')) count += 1;
            continue;
        }
        if (language === 'swift') {
            if (node.parent?.type === 'statements') count += 1;
        } else if (language === 'python') {
            if (node.type === 'class_definition') count += 1;
            if (node.type.endsWith('_statement') && node.type !== 'decorated_definition') count += 1;
        } else if (
            node.type === 'command' ||
            node.type === 'declaration_command' ||
            (node.type === 'variable_assignment' &&
                node.parent?.type !== 'declaration_command' &&
                node.parent?.type !== 'command') ||
            (node.type.endsWith('_statement') && node.type !== 'compound_statement')
        )
            count += 1;
        count += executableStatements(node.namedChildren, language);
    }
    return count;
}

/** Whether every declaration is an import, alias, forwarding statement, or trivial function. */
export function trivialFile(root: Node, language: 'python' | 'swift' | 'bash', threshold: number): boolean {
    const substantial = (node: Node): boolean => {
        if (node.type.includes('comment') || node.type.startsWith('import') || node.type === 'hash_bang_line')
            return false;
        if (node.type === 'computed_property' && !node.namedChildren.some((child) => child.type === 'statements'))
            return node.namedChildren.some(substantial);
        if (FUNCTIONS.has(node.type)) {
            if (node.type === 'lambda') return false;
            const body = node.childForFieldName('body') ?? node;
            const children = body.namedChildren.filter(
                (child, index) =>
                    !(
                        language === 'python' &&
                        index === 0 &&
                        child.type === 'expression_statement' &&
                        child.namedChildren[0]?.type === 'string'
                    ),
            );
            return executableStatements(children, language) > threshold;
        }
        if (
            [
                'decorated_definition',
                'class_definition',
                'class_declaration',
                'class_body',
                'block',
                'source_file',
                'module',
                'program',
                'computed_property',
            ].includes(node.type)
        ) {
            const body = node.childForFieldName('body');
            return (body?.namedChildren ?? node.namedChildren)
                .filter(
                    (child) =>
                        !['identifier', 'type_identifier', 'modifiers', 'decorator', 'inheritance_specifier'].includes(
                            child.type,
                        ),
                )
                .some(substantial);
        }
        if (node.type === 'expression_statement') {
            const child = node.namedChildren[0];
            return child !== undefined && child.type !== 'string' && substantial(child);
        }
        if (['identifier', 'simple_identifier', 'attribute', 'navigation_expression'].includes(node.type)) return false;
        if (node.type === 'assignment') {
            if (node.childForFieldName('left')?.text === '__all__') return false;
            const value = node.childForFieldName('right');
            return node.childForFieldName('type') !== null || (value !== null && substantial(value));
        }
        if (node.type === 'property_declaration') {
            const computed = node.childForFieldName('computed_value');
            return computed === null || substantial(computed);
        }
        if (node.type === 'type_alias_statement' || node.type === 'typealias_declaration') {
            const value = node.childForFieldName('value') ?? node.namedChildren.at(-1);
            return value !== undefined && !['type', 'user_type', 'identifier', 'type_identifier'].includes(value.type);
        }
        if (language === 'bash' && node.type === 'command') {
            const name = node.childForFieldName('name')?.text;
            return name !== 'source' && name !== '.';
        }
        return true;
    };
    const statements = root.namedChildren.filter(
        (node, index) =>
            !node.type.includes('comment') &&
            !(
                language === 'python' &&
                root.namedChildren.slice(0, index).every((previous) => previous.type.includes('comment')) &&
                node.type === 'expression_statement' &&
                node.namedChildren[0]?.type === 'string'
            ),
    );
    return statements.length > 0 && !statements.some(substantial);
}
