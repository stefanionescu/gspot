import type { TSESTree } from '@typescript-eslint/utils';

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const TYPE_ONLY = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSDeclareFunction']);

/**
 * Count executable statements without entering nested functions or type declarations.
 * @param node the node to count under
 * @param visitorKeys the child keys of each node type, from the parser
 * @returns the count
 */
export function statementCount(node: TSESTree.Node, visitorKeys: Readonly<Record<string, readonly string[]>>): number {
    if (TYPE_ONLY.has(node.type) || ('declare' in node && node.declare)) return 0;
    if (FUNCTIONS.has(node.type)) return node.type === 'FunctionDeclaration' ? 1 : 0;
    const own =
        (node.type.endsWith('Statement') && node.type !== 'BlockStatement' && node.type !== 'EmptyStatement') ||
        node.type === 'VariableDeclaration' ||
        node.type === 'TSEnumDeclaration' ||
        node.type === 'ClassDeclaration'
            ? 1
            : 0;
    let count = own;
    for (const key of visitorKeys[node.type] ?? []) {
        const child = (node as unknown as Record<string, unknown>)[key];
        if (Array.isArray(child)) {
            for (const item of child) if (item !== null) count += statementCount(item as TSESTree.Node, visitorKeys);
        } else if (child !== null && typeof child === 'object')
            count += statementCount(child as TSESTree.Node, visitorKeys);
    }
    return count;
}
