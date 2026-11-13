import { AST_NODE_TYPES, ASTUtils, type TSESTree } from '@typescript-eslint/utils';

import { AXIOS_CANCEL_TOKEN, AXIOS_CONFIG_POSITIONS, AXIOS_DEPRECATIONS } from '../../config/utilities.ts';
import { getModuleName } from '../../language/modules.ts';
import { createRule } from '../../rule.ts';

function listCancelTokens(node: TSESTree.CallExpression, name: string): TSESTree.Property[] {
    const configs = (AXIOS_CONFIG_POSITIONS.get(name) ?? []).map((position) => node.arguments[position]);
    const options = configs.flatMap((config) =>
        config?.type === AST_NODE_TYPES.ObjectExpression ? config.properties : [],
    );
    return options.filter(
        (option): option is TSESTree.Property =>
            option.type === AST_NODE_TYPES.Property && ASTUtils.getPropertyName(option) === 'cancelToken',
    );
}

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
                for (const option of listCancelTokens(node, name))
                    context.report({ node: option, messageId: 'cancelToken' });
            },
            'MemberExpression[property.name="CancelToken"]': function (node: TSESTree.MemberExpression) {
                const name = getModuleName(node, source);
                const isCancelToken = name === AXIOS_CANCEL_TOKEN;
                if (isCancelToken) context.report({ node, messageId: 'cancelToken' });
            },
        };
    },
});
