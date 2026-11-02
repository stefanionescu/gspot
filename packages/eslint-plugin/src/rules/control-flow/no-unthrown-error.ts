import { createRule } from '../../rule.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { ERROR_CONSTRUCTOR_SUFFIX } from '../../config/logic.ts';

export const noUnthrownError = createRule<[], 'error'>({
    name: 'no-unthrown-error',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Reports discarded constructor calls whose names end with Error or Exception.',
            why: 'Constructing an error without throwing or retaining it does not stop the failing operation.',
            fix: 'Throw the error, return it, or store it for the caller that handles the failure.',
            example:
                '`new TypeError("Invalid value");` reports a finding. Use `throw new TypeError("Invalid value");`.',
        },
        schema: [],
        messages: { error: 'Throw this error, return it, or store it for the code that handles the failure.' },
    },
    create(context) {
        return {
            NewExpression(node) {
                if (node.parent.type !== AST_NODE_TYPES.ExpressionStatement) return;
                const constructor = context.sourceCode.getText(node.callee);
                if (!ERROR_CONSTRUCTOR_SUFFIX.test(constructor)) return;
                context.report({ node, messageId: 'error' });
            },
        };
    },
});
