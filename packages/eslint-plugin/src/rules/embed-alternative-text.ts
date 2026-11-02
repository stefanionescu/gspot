import { createRule } from '../rule.ts';
import { getAttribute, getElementName } from '../libraries/jsx.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function isHiddenElement(element: TSESTree.JSXOpeningElement): boolean {
    const type = getAttribute(element, 'type')?.value;
    const isHiddenInput =
        getElementName(element.name).toUpperCase() === 'INPUT' &&
        typeof type === 'string' &&
        type.toUpperCase() === 'HIDDEN';
    return isHiddenInput || getAttribute(element, 'aria-hidden')?.value === true;
}

function hasVisibleChildren(children: readonly TSESTree.JSXChild[]): boolean {
    return children.some((child) => {
        switch (child.type) {
            case AST_NODE_TYPES.JSXText: {
                return child.value.trim() !== '';
            }
            case AST_NODE_TYPES.JSXFragment: {
                return hasVisibleChildren(child.children);
            }
            case AST_NODE_TYPES.JSXElement: {
                return !isHiddenElement(child.openingElement);
            }
            case AST_NODE_TYPES.JSXExpressionContainer: {
                const { expression } = child;
                return ASTUtils.isIdentifier(expression)
                    ? expression.name !== 'undefined'
                    : expression.type !== AST_NODE_TYPES.JSXEmptyExpression;
            }
            default: {
                return false;
            }
        }
    });
}

export const embedAlternativeText = createRule<[], 'missingContent'>({
    name: 'embed-alternative-text',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Finds JSX `<object>` elements without visible content between their tags: text, an element that is not hidden, or an expression.',
            why: 'Screen readers and browsers that cannot show the embedded object fall back to the content of the element.',
            fix: 'Write a text alternative between the tags, such as `<object data="chart.svg">Sales grew by 12 percent in 2025.</object>`.',
            example:
                'The element `<object data="chart.svg" />` reports `missingContent`. Use `<object data="chart.svg">Sales by month</object>`.',
        },
        schema: [],
        messages: { missingContent: 'Add accessible content between the tags of this <object>.' },
    },
    create(context) {
        return {
            JSXElement(node) {
                const isEmbedding = getElementName(node.openingElement.name).toLowerCase() === 'object';
                if (isEmbedding && !hasVisibleChildren(node.children))
                    context.report({ node, messageId: 'missingContent' });
            },
        };
    },
});
