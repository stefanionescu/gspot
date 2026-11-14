import { ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { CYPRESS_ACTIONS, PLAYWRIGHT_ACTIONS } from '../../config/testing.ts';
import { getExpressionValue, getLiteralValue, getOptionProperties } from '../../language/expressions.ts';
import { isModuleUsed, readPackageFacts } from '../../language/packages.ts';
import { listBodyNodes } from '../../language/syntax.ts';
import { isCypressChain, isLocatorQuery } from '../../libraries/testing.ts';
import { createRule } from '../../rule.ts';
import type { MemberCall } from '../../types/plugin.ts';
import type { UiFrameworks } from '../../types/testing.ts';

/**
Check whether the value of an action receiver holds a Playwright locator query. A locator, an element handle, and an
entry of `all()` take the `force` option alike, so the receiver does not have to be a locator.
*/
function hasLocatorQuery(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const value = getExpressionValue(node, source);
    return value !== undefined && listBodyNodes(value, source).some((each) => isLocatorQuery(each));
}

function getActionPosition(
    node: MemberCall,
    source: TSESLint.SourceCode,
    frameworks: UiFrameworks,
): number | undefined {
    const name = ASTUtils.getPropertyName(node.callee);
    const cypress = frameworks.hasCypress && isCypressChain(node.callee.object) ? CYPRESS_ACTIONS.get(name) : undefined;
    const playwright =
        frameworks.hasPlaywright && hasLocatorQuery(node.callee.object, source)
            ? PLAYWRIGHT_ACTIONS.get(name)
            : undefined;
    return cypress ?? playwright;
}

export const noForcedUiActions = createRule<[], 'force'>({
    name: 'no-forced-ui-actions',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description: 'Reports `{ force: true }` on a Cypress or Playwright action, such as `click` or `type`.',
            why: 'A forced action skips the checks that the element is visible, enabled, and not covered, so the test passes where a user could not act.',
            fix: 'Remove the option, and wait for the element to be ready, or fix what covers it.',
            example:
                '`cy.get("button").click({ force: true })` reports `force`. Write `cy.get("button").should("be.visible").click()`.',
        },
        schema: [],
        messages: { force: 'Remove this forced interaction and wait for the element to be actionable instead.' },
    },
    create(context) {
        const frameworks = {
            hasCypress: readPackageFacts(context).dependencies.has('cypress'),
            hasPlaywright: isModuleUsed(context, ['@playwright/test']),
        };
        if (!frameworks.hasCypress && !frameworks.hasPlaywright) return {};
        const source = context.sourceCode;
        return {
            'CallExpression[callee.type="MemberExpression"]': function (node: MemberCall) {
                const position = getActionPosition(node, source, frameworks);
                const options =
                    position !== undefined && node.arguments.length > position ? node.arguments.at(-1) : undefined;
                const force = getOptionProperties(options, source).get('force');
                if (force !== undefined && getLiteralValue(force.value, source) === true)
                    context.report({ node: force, messageId: 'force' });
            },
        };
    },
});
