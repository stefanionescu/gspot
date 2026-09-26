import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const ENVIRONMENT_HOSTS = new Set(['process', 'Bun', 'Deno']);

/**
 *
 * @param node
 */
export function memberName(node: TSESTree.MemberExpression): string | undefined {
    if (node.computed) return node.property.type === AST_NODE_TYPES.Literal ? String(node.property.value) : undefined;
    return node.property.type === AST_NODE_TYPES.Identifier ? node.property.name : undefined;
}

/**
 *
 * @param context
 * @param node
 */
export function isGlobalEnvironmentHost(
    context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
    node: TSESTree.Node,
): boolean {
    if (node.type !== AST_NODE_TYPES.Identifier || !ENVIRONMENT_HOSTS.has(node.name)) return false;
    let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(node);
    while (scope !== null) {
        const variable = scope.set.get(node.name);
        if (variable !== undefined) return variable.defs.length === 0;
        scope = scope.upper;
    }
    return true;
}
