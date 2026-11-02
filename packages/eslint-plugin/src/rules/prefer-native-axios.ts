import { createRule } from '../rule.ts';
import { getModuleName } from '../modules.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { AXIOS_DEPRECATIONS, AXIOS_CANCEL_TOKEN, AXIOS_CONFIG_POSITIONS } from '../config/frameworks.ts';

export const preferNativeAxios = createRule<[], 'helper' | 'cancelToken'>({
    name: 'prefer-native-axios',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports the deprecated Axios helpers `axios.all()` and `axios.spread()`, each use of `axios.CancelToken`, and a `cancelToken` option in the config argument of an Axios request.',
            why: 'Axios deprecated these helpers and CancelToken. The language and the platform give the same behavior without them.',
            fix: 'Use `Promise.all()` for `axios.all()`, array destructuring for `axios.spread()`, and an `AbortController` signal for cancellation.',
            example: '`axios.all([first, second])` reports `helper`. Write `Promise.all([first, second])`.',
        },
        schema: [],
        messages: {
            helper: '{{symbol}} is a deprecated Axios helper; {{alternative}} is the native equivalent.',
            cancelToken:
                'CancelToken is a deprecated Axios API; AbortController is the standard cancellation mechanism.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            CallExpression(node) {
                const name = getModuleName(node.callee, source) ?? '';
                const deprecation = AXIOS_DEPRECATIONS.get(name);
                if (deprecation !== undefined) context.report({ node, messageId: 'helper', data: deprecation });
                const configs = (AXIOS_CONFIG_POSITIONS.get(name) ?? []).map((position) => node.arguments[position]);
                const options = configs.flatMap((config) =>
                    config?.type === AST_NODE_TYPES.ObjectExpression ? config.properties : [],
                );
                for (const option of options.filter(
                    (each) => each.type === AST_NODE_TYPES.Property && ASTUtils.getPropertyName(each) === 'cancelToken',
                ))
                    context.report({ node: option, messageId: 'cancelToken' });
            },
            'MemberExpression[property.name="CancelToken"]'(node: TSESTree.MemberExpression) {
                const name = getModuleName(node, source);
                const isCancelToken = name === AXIOS_CANCEL_TOKEN;
                if (isCancelToken) context.report({ node, messageId: 'cancelToken' });
            },
        };
    },
});
