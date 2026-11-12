import { AST_NODE_TYPES, ASTUtils, type TSESTree } from '@typescript-eslint/utils';

import { REDUCE_METHOD } from '../../config/collections.ts';
import { getTypeCategory, getTypes } from '../../language/checker.ts';
import { getAssignedValue } from '../../language/variables.ts';
import { createRule } from '../../rule.ts';

export const requireReduceInitialValue = createRule<[], 'initial'>({
    name: 'require-reduce-initial-value',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports `reduce` called on an array with a callback and no initial value. Without type information, it reads only array literals and variables that hold one.',
            why: '`reduce` without an initial value throws on an empty array, and uses the first element as the start value, which may have the wrong type.',
            fix: 'Pass the start value as the second argument, such as `items.reduce((sum, item) => sum + item, 0)`.',
            example:
                '`prices.reduce((sum, price) => sum + price)` reports `initial`. Add `, 0` as the second argument.',
        },
        schema: [],
        messages: { initial: 'Pass an initial value to reduce. Without it, an empty array throws.' },
    },
    create(context) {
        const types = getTypes(context);
        const isArray = (node: TSESTree.Node) => {
            if (types !== undefined) return getTypeCategory(types, types.get(node)) === 'array';
            const variable = ASTUtils.isIdentifier(node)
                ? ASTUtils.findVariable(context.sourceCode.getScope(node), node)
                : null;
            const value = variable === null ? node : getAssignedValue(variable);
            return value?.type === AST_NODE_TYPES.ArrayExpression;
        };
        return {
            CallExpression(node) {
                const { callee } = node;
                if (
                    callee.type !== AST_NODE_TYPES.MemberExpression ||
                    node.arguments.length !== 1 ||
                    ASTUtils.getPropertyName(callee) !== REDUCE_METHOD ||
                    !isArray(callee.object)
                )
                    return;
                context.report({ node: callee.property, messageId: 'initial' });
            },
        };
    },
});
