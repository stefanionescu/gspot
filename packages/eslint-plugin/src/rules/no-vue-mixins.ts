import { createRule } from '../rule.ts';
import { usesVueThree } from '../libraries/packages.ts';
import { getExpressionValue } from '../language/expressions.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

export const noVueMixins = createRule<[], 'mixin'>({
    name: 'no-vue-mixins',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports a `mixins` property whose value is an array, written in place or held by a variable, in an object of a project whose package.json allows Vue 3.',
            why: 'A mixin merges its options into the component without a name, so a reader cannot tell where a property comes from, and two mixins can overwrite each other.',
            fix: 'Move the shared logic into a composable function, and call it from `setup`.',
            example: '`defineComponent({ mixins: [tracking] })` reports `mixin`. Write `setup() { useTracking(); }`.',
        },
        schema: [],
        messages: { mixin: 'Replace this mixin with a Vue composable.' },
    },
    create(context) {
        if (!usesVueThree(context)) return {};
        return {
            'ObjectExpression > Property'(node: TSESTree.Property) {
                const source = context.sourceCode;
                const value =
                    ASTUtils.getPropertyName(node) === 'mixins' ? getExpressionValue(node.value, source) : undefined;
                if (value?.type === AST_NODE_TYPES.ArrayExpression) context.report({ node, messageId: 'mixin' });
            },
        };
    },
});
