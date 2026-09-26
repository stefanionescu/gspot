import { ASTUtils, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { ENVIRONMENT_HOSTS } from '#plugin/constants/plugin.ts';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

/**
 * The property name a member expression reads, when it is spelled out.
 * @param node the member expression
 * @returns the name, or undefined for a computed key that is not a literal
 */
export function memberName(node: TSESTree.MemberExpression): string | undefined {
    if (node.computed) return node.property.type === AST_NODE_TYPES.Literal ? String(node.property.value) : undefined;
    return node.property.type === AST_NODE_TYPES.Identifier ? node.property.name : undefined;
}

/**
 * Whether an identifier is the global process or import.meta host, and not a local binding of the same name.
 * @param context the rule context, for scope analysis
 * @param node the node under inspection
 * @returns whether the name reaches the global
 */
export function isGlobalEnvironmentHost(
    context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
    node: TSESTree.Node,
): boolean {
    if (node.type !== AST_NODE_TYPES.Identifier || !ENVIRONMENT_HOSTS.has(node.name)) return false;
    const variable = ASTUtils.findVariable(context.sourceCode.getScope(node), node.name);
    return variable === null || variable.defs.length === 0;
}
