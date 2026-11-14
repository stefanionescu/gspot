import { createRule } from '../../rule.ts';
import { getTypes } from '../../language/checker.ts';
import { listImportedModules } from '../../language/modules.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { LEAKING_TYPES, NATIVE_LEAKING_TYPES } from '../../config/react.ts';

function listOperands(node: TSESTree.Expression): TSESTree.Expression[] {
    const operands: TSESTree.Expression[] = [];
    const pending = [node];
    for (let value = pending.pop(); value !== undefined; value = pending.pop()) {
        if (value.type === AST_NODE_TYPES.LogicalExpression) pending.push(value.right, value.left);
        else operands.push(value);
    }
    return operands;
}

export const noLeakedJsxNumber = createRule<[], 'leaked' | 'convert'>({
    name: 'no-leaked-jsx-number',
    meta: {
        defaultOptions: [],
        type: 'problem',
        hasSuggestions: true,
        docs: {
            level: 'recommended',
            requiresTypeChecking: true,
            description:
                'Reports the left side of `&&` inside a JSX expression when its type is a number or a bigint, and also a string in files that import React Native.',
            why: 'React renders a falsy number such as 0 instead of nothing, and React Native fails on a string outside a Text element.',
            fix: 'Turn the condition into a boolean, such as `count > 0` or `Boolean(name)`.',
            example: '`{count && <Badge />}` with a number `count` reports `leaked`. Write `{count > 0 && <Badge />}`.',
        },
        schema: [],
        messages: {
            leaked: 'Convert the condition to a boolean, so no number or string leaks into the output.',
            convert: 'Convert the condition to a boolean.',
        },
    },
    create(context) {
        const types = getTypes(context);
        if (types === undefined) return {};
        const leaking = listImportedModules(context.sourceCode).has('react-native')
            ? NATIVE_LEAKING_TYPES
            : LEAKING_TYPES;
        return {
            'JSXExpressionContainer > LogicalExpression[operator="&&"]': function (node: TSESTree.LogicalExpression) {
                const operands = listOperands(node.left);
                const leaked = operands.filter((operand) => {
                    const type = types.checker.getBaseTypeOfLiteralType(types.get(operand));
                    return leaking.has(types.checker.typeToString(type));
                });
                for (const operand of leaked)
                    context.report({
                        node: operand,
                        messageId: 'leaked',
                        suggest: [
                            {
                                messageId: 'convert',
                                fix: (fixer) =>
                                    fixer.replaceText(operand, `!!(${context.sourceCode.getText(operand)})`),
                            },
                        ],
                    });
            },
        };
    },
});
