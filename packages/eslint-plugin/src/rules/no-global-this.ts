import { createRule } from '../rule.ts';
import { TSESLint, AST_NODE_TYPES } from '@typescript-eslint/utils';

export const noGlobalThis = createRule<[], 'this'>({
    name: 'no-global-this',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description: 'Reports property access through this in global or module scope outside classes.',
            why: 'Top-level this has different meanings in scripts and modules, so the property access depends on how code loads.',
            fix: 'Name the intended variable or global object explicitly.',
            example: '`this.location` at module scope reports a finding. Use the intended global object explicitly.',
        },
        schema: [],
        messages: { this: 'Name the intended variable or global object instead of using top-level this.' },
    },
    create(context) {
        return {
            MemberExpression(node) {
                if (node.object.type !== AST_NODE_TYPES.ThisExpression) return;
                const scope = context.sourceCode.getScope(node).variableScope.type;
                if (scope !== TSESLint.Scope.ScopeType.global && scope !== TSESLint.Scope.ScopeType.module) return;
                if (
                    context.sourceCode
                        .getAncestors(node)
                        .some(
                            (ancestor) =>
                                ancestor.type === AST_NODE_TYPES.ClassDeclaration ||
                                ancestor.type === AST_NODE_TYPES.ClassExpression,
                        )
                )
                    return;
                context.report({ node: node.object, messageId: 'this' });
            },
        };
    },
});
