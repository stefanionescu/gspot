import { createRule } from '../rule.ts';
import { readExpressionValue } from '../expressions.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { WEB_URL, NO_OPENER_FEATURE, WINDOW_OPEN_SELECTOR, WINDOW_FEATURES_ARGUMENT } from '../config/web.ts';

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
        const readText = (node: TSESTree.Node | undefined): string => {
            const value = readExpressionValue(node, source);
            const text = value?.type === AST_NODE_TYPES.Literal ? value.value : undefined;
            return typeof text === 'string' ? text : '';
        };
        return {
            [WINDOW_OPEN_SELECTOR](node: TSESTree.CallExpression) {
                const { object, property } = node.callee as TSESTree.MemberExpression;
                const isWindow =
                    (ASTUtils.isIdentifier(object) && object.name === 'window') ||
                    (object.type === AST_NODE_TYPES.MemberExpression &&
                        object.object.type === AST_NODE_TYPES.ThisExpression &&
                        ASTUtils.getPropertyName(object) === 'window');
                const features = readText(node.arguments[WINDOW_FEATURES_ARGUMENT]);
                if (isWindow && WEB_URL.test(readText(node.arguments[0])) && !features.includes(NO_OPENER_FEATURE))
                    context.report({ node: property, messageId: 'opener' });
            },
        };
    },
});
