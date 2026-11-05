import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { SIGNED_NUMBER_OPERATORS } from '../../config/testing.ts';
import { getExpressionValue } from '../../language/expressions.ts';
import { isCypressChain, isTestRelatedPath } from '../../libraries/testing.ts';
import { createRule } from '../../rule.ts';

function isNumericDelay(node: TSESTree.Node | undefined, source: TSESLint.SourceCode): boolean {
    let value = getExpressionValue(node, source);
    if (value?.type === AST_NODE_TYPES.UnaryExpression) {
        if (!SIGNED_NUMBER_OPERATORS.has(value.operator)) return false;
        value = value.argument;
    }
    return value?.type === AST_NODE_TYPES.Literal && typeof value.value === 'number';
}

function isFixedWait(node: TSESTree.CallExpression, source: TSESLint.SourceCode): boolean {
    const { callee } = node;
    if (
        callee.type !== AST_NODE_TYPES.MemberExpression ||
        callee.computed ||
        callee.property.type !== AST_NODE_TYPES.Identifier
    )
        return false;
    if (callee.property.name === 'waitForTimeout')
        return callee.object.type === AST_NODE_TYPES.Identifier && callee.object.name === 'page';
    return (
        callee.property.name === 'wait' && isCypressChain(callee.object) && isNumericDelay(node.arguments[0], source)
    );
}

export const noFixedTestWaits = createRule<[], 'wait'>({
    name: 'no-fixed-test-waits',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Reports fixed Cypress and Playwright waits in test-related files.',
            why: 'A fixed delay can be too short on a busy machine and wastes time when the page is already ready.',
            fix: 'Wait for the request, element, or condition that the next assertion depends on.',
            example: '`cy.wait(1000)` reports a finding. Wait for an aliased request or a visible element instead.',
        },
        schema: [],
        messages: { wait: 'Wait for an observable condition instead of a fixed delay.' },
    },
    create(context) {
        if (!isTestRelatedPath(context.filename, context.settings['testFileExtensions'])) return {};
        return {
            CallExpression(node) {
                if (!isFixedWait(node, context.sourceCode)) return;
                context.report({ node: node.callee, messageId: 'wait' });
            },
        };
    },
});
