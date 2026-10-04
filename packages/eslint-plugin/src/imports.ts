import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

/**
 * True for an import declaration or a CommonJS require statement.
 * @param node the statement
 * @param context the ESLint context with its declared source type
 * @returns whether the statement belongs to the import block
 */
export function isImportLike(
    node: TSESTree.Statement,
    context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
): boolean {
    if (node.type === AST_NODE_TYPES.ImportDeclaration) return true;
    if (context.languageOptions.sourceType !== 'commonjs') return false;
    if (node.type === AST_NODE_TYPES.ExpressionStatement) return isRequireCall(node.expression);
    return (
        node.type === AST_NODE_TYPES.VariableDeclaration &&
        node.declarations.length === 1 &&
        isRequireCall(node.declarations[0].init)
    );
}

/**
 * Whether a node calls require with one argument.
 * @param node the node, which may be absent
 * @returns whether it is a require call
 */
export function isRequireCall(node: TSESTree.Node | null | undefined): boolean {
    return (
        node?.type === AST_NODE_TYPES.CallExpression &&
        node.callee.type === AST_NODE_TYPES.Identifier &&
        node.callee.name === 'require' &&
        node.arguments.length === 1
    );
}
