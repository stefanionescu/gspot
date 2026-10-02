import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { ImplementedFunction } from '#plugin/types/plugin.ts';
import { FUNCTIONS, TYPE_ONLY, EXECUTABLE_STATEMENTS } from '#plugin/config/plugin.ts';

// Read syntax children through the parser visitor keys. Metadata and parent links are excluded.
function childNodes(node: TSESTree.Node, visitorKeys: Readonly<Record<string, readonly string[]>>): TSESTree.Node[] {
    return (visitorKeys[node.type] ?? []).flatMap((key) => {
        const child: unknown = node[key as keyof TSESTree.Node];
        if (Array.isArray(child)) return child.filter((item: unknown) => item !== null) as TSESTree.Node[];
        return child !== null && typeof child === 'object' ? [child as TSESTree.Node] : [];
    });
}

/**
 * Count the executable statements under a node, those of the functions written inside it included. An expression
 * body counts as one statement.
 * @param node the function implementation, or a node inside it
 * @param visitorKeys the child keys of each node type, from the parser
 * @returns the count
 */
export function totalStatements(node: TSESTree.Node, visitorKeys: Readonly<Record<string, readonly string[]>>): number {
    if (TYPE_ONLY.has(node.type) || ('declare' in node && node.declare)) return 0;
    const isExpressionBody =
        FUNCTIONS.has(node.type) && (node as ImplementedFunction).body.type !== AST_NODE_TYPES.BlockStatement;
    const own = isExpressionBody || EXECUTABLE_STATEMENTS.has(node.type) ? 1 : 0;
    return childNodes(node, visitorKeys).reduce((total, child) => total + totalStatements(child, visitorKeys), own);
}

/**
 * Identify constructors whose parameters or assignments initialize instance state.
 * @param node the implemented function
 * @returns whether removing the constructor loses its instance initialization contract
 */
export function hasConstructorState(node: ImplementedFunction): boolean {
    if (node.parent.type !== AST_NODE_TYPES.MethodDefinition || node.parent.kind !== 'constructor') return false;
    if (node.params.some((parameter) => parameter.type === AST_NODE_TYPES.TSParameterProperty)) return true;
    if (node.body.type !== AST_NODE_TYPES.BlockStatement) return false;
    return node.body.body.some(
        (statement) =>
            statement.type === AST_NODE_TYPES.ExpressionStatement &&
            statement.expression.type === AST_NODE_TYPES.AssignmentExpression &&
            statement.expression.left.type === AST_NODE_TYPES.MemberExpression &&
            statement.expression.left.object.type === AST_NODE_TYPES.ThisExpression,
    );
}
