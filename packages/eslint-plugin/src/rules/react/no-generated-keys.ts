import { createRule } from '../../rule.ts';
import { listBodyNodes } from '../../libraries/testing.ts';
import { GENERATED_KEY_CALLS } from '../../config/frameworks.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

export const noGeneratedKeys = createRule<[], 'generated'>({
    name: 'no-generated-keys',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a JSX `key` whose value calls `Math.random()` or `Date.now()`, alone or inside a template, a sum, `String()`, or `.toString()`.',
            why: 'A key that changes on each render makes React drop and rebuild the element, which loses its state and focus and slows every render.',
            fix: 'Use a stable value that identifies the element, such as the id of the record it shows.',
            example: '`<Row key={Math.random()} />` reports `generated`. Write `<Row key={row.id} />`.',
        },
        schema: [],
        messages: { generated: 'Do not use generated values for keys of React list components.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'JSXAttribute[name.name="key"] > JSXExpressionContainer.value'(node: TSESTree.JSXExpressionContainer) {
                const { expression } = node;
                const isGenerated = listBodyNodes(expression, source).some(
                    (each) =>
                        each.type === AST_NODE_TYPES.CallExpression &&
                        GENERATED_KEY_CALLS.has(source.getText(each.callee)),
                );
                if (isGenerated) context.report({ node: expression, messageId: 'generated' });
            },
        };
    },
});
