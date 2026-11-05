import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { createRule } from '../../rule.ts';

function hasDiscardedUpdate(node: TSESTree.UpdateExpression, source: TSESLint.SourceCode): boolean {
    const { argument, parent } = node;
    if (node.prefix || argument.type !== AST_NODE_TYPES.Identifier) return false;
    if (parent.type === AST_NODE_TYPES.AssignmentExpression)
        return parent.left.type === AST_NODE_TYPES.Identifier && parent.left.name === argument.name;
    if (parent.type !== AST_NODE_TYPES.ReturnStatement) return false;
    return source
        .getScope(node)
        .variables.some((variable) => variable.identifiers.some((identifier) => identifier.name === argument.name));
}

export const noDiscardedPostfix = createRule<[], 'update'>({
    name: 'no-discarded-postfix',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports postfix updates assigned back to the same variable or returned from the declaring scope.',
            why: 'A postfix expression returns the old value, so an assignment or return can discard the intended update.',
            fix: 'Check which value must be assigned or returned. Preserve mutations that another closure observes.',
            example: '`count = count++` keeps the old value. Use `count += 1` when an increment is intended.',
        },
        schema: [],
        messages: {
            update: 'Check whether the old value or updated value is intended here, preserving observable mutations.',
        },
    },
    create(context) {
        return {
            UpdateExpression: (node) => {
                if (hasDiscardedUpdate(node, context.sourceCode)) context.report({ node, messageId: 'update' });
            },
        };
    },
});
