import { createRule } from '../../rule.ts';
import { REDUCE_METHOD } from '../../config/builtins.ts';
import { getAssignedValue } from '../../language/modules.ts';
import { getTypes, getTypeCategory } from '../../language/checker.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

export const requireReduceInitialValue = createRule<[], 'initial'>({
    name: 'require-reduce-initial-value',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports `reduce` called on an array with a callback and no initial value. With type information it checks every array; without it, an array literal and a variable whose one value is an array literal.',
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
                if (callee.type !== AST_NODE_TYPES.MemberExpression || node.arguments.length !== 1) return;
                if (ASTUtils.getPropertyName(callee) !== REDUCE_METHOD || !isArray(callee.object)) return;
                context.report({ node: callee.property, messageId: 'initial' });
            },
        };
    },
});
