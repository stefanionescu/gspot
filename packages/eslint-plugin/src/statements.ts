import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

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
    if (FUNCTIONS.has(node.type)) return node.type === AST_NODE_TYPES.FunctionDeclaration ? 1 : 0;
    const own =
        (node.type.endsWith('Statement') &&
            node.type !== AST_NODE_TYPES.BlockStatement &&
            node.type !== AST_NODE_TYPES.EmptyStatement) ||
        node.type === AST_NODE_TYPES.VariableDeclaration ||
        node.type === AST_NODE_TYPES.TSEnumDeclaration ||
        node.type === AST_NODE_TYPES.ClassDeclaration
            ? 1
            : 0;
    let count = own;
    for (const key of visitorKeys[node.type] ?? []) {
        const child: unknown = node[key as keyof TSESTree.Node];
        if (Array.isArray(child)) {
            for (const item of child) if (item !== null) count += statementCount(item as TSESTree.Node, visitorKeys);
        } else if (child !== null && typeof child === 'object')
            count += statementCount(child as TSESTree.Node, visitorKeys);
    }
    return count;
}
