import { AST_NODE_TYPES, ASTUtils, type TSESTree } from '@typescript-eslint/utils';

import { NO_OPENER_FEATURE, WEB_URL, WINDOW_FEATURES_ARGUMENT, WINDOW_OPEN_SELECTOR } from '../../config/web.ts';
import { getExpressionValue } from '../../language/expressions.ts';
import { createRule } from '../../rule.ts';
import type { MemberCall } from '../../types/plugin.ts';

export const requireNoopener = createRule<[], 'opener'>({
    name: 'require-noopener',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `window.open` and `this.window.open` calls that open an `http` or `https` URL without `noopener` in the window features.',
            why: 'The opened page gets a reference to the page that opened it, so it can send that page to another address, such as a phishing copy.',
            fix: 'Pass `noopener` in the window features: `window.open(url, "_blank", "noopener")`.',
            example:
                'The call `window.open("https://example.com", "_blank")` reports `opener`. Use `window.open("https://example.com", "_blank", "noopener")`.',
        },
        schema: [],
        messages: {
            opener: 'Add noopener to the features of this window, so the opened page cannot control this one.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const getText = (node: TSESTree.Node | undefined): string => {
            const value = getExpressionValue(node, source);
            const text = value?.type === AST_NODE_TYPES.Literal ? value.value : undefined;
            return typeof text === 'string' ? text : '';
        };
        return {
            [WINDOW_OPEN_SELECTOR](node: MemberCall) {
                const { object, property } = node.callee;
                const isWindow =
                    (ASTUtils.isIdentifier(object) && object.name === 'window') ||
                    (object.type === AST_NODE_TYPES.MemberExpression &&
                        object.object.type === AST_NODE_TYPES.ThisExpression &&
                        ASTUtils.getPropertyName(object) === 'window');
                const features = getText(node.arguments[WINDOW_FEATURES_ARGUMENT]);
                if (isWindow && WEB_URL.test(getText(node.arguments[0])) && !features.includes(NO_OPENER_FEATURE))
                    context.report({ node: property, messageId: 'opener' });
            },
        };
    },
});
