import { ENVIRONMENT_HOSTS } from '#plugin/config/environment.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

/**
 * Find environment access through global hosts, aliases, destructuring, and import.meta.
 * @param context the rule context with declared runtime globals.
 * @param inspect the rule's decision for each environment access.
 * @returns listeners that find environment access once.
 */
export function environmentReads(
    context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
    inspect: (node: TSESTree.Node) => void,
): TSESLint.RuleListener {
    return {
        MemberExpression(node) {
            if (
                node.object.type === AST_NODE_TYPES.MetaProperty &&
                node.object.meta.name === 'import' &&
                node.object.property.name === 'meta' &&
                ASTUtils.getPropertyName(node) === 'env'
            )
                inspect(node);
        },
        'Program:exit'(node) {
            const tracker = new ASTUtils.ReferenceTracker(context.sourceCode.getScope(node));
            const trace = Object.fromEntries(
                ENVIRONMENT_HOSTS.map((host) => [host, { env: { [ASTUtils.ReferenceTracker.READ]: true } }]),
            );
            for (const reference of tracker.iterateGlobalReferences(trace)) inspect(reference.node);
        },
    };
}

/**
 * Read the statically named variables taken from an environment object. An empty list means the whole object or a dynamic key.
 * @param node the environment access.
 * @returns variable names used directly or through destructuring.
 */
export function environmentNames(node: TSESTree.Node): (string | null)[] {
    const { parent } = node;
    if (parent?.type === AST_NODE_TYPES.MemberExpression && parent.object === node)
        return [ASTUtils.getPropertyName(parent)];
    if (parent?.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.ObjectPattern)
        return parent.id.properties.map((property) =>
            property.type === AST_NODE_TYPES.RestElement ? null : ASTUtils.getPropertyName(property),
        );
    return [];
}
