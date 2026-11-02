import { createRule } from '../rule.ts';
import { usesModule, readPackageFacts } from '../packages.ts';
import { listBodyNodes, isCypressChain } from '../testing.ts';
import type { MemberCall, UiFrameworks } from '../types/rules.ts';
import { getLiteralValue, getExpressionValue, getOptionProperties } from '../expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    CYPRESS_ACTIONS,
    PLAYWRIGHT_ACTIONS,
    PLAYWRIGHT_LOCATORS,
    PLAYWRIGHT_QUERY_PREFIX,
} from '../config/testing.ts';

function isLocator(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const value = getExpressionValue(node, source);
    if (value === undefined) return false;
    const names = listBodyNodes(value, source).flatMap((each) =>
        each.type === AST_NODE_TYPES.CallExpression && each.callee.type === AST_NODE_TYPES.MemberExpression
            ? [ASTUtils.getPropertyName(each.callee) ?? '']
            : [],
    );
    return names.some((name) => PLAYWRIGHT_LOCATORS.has(name) || name.startsWith(PLAYWRIGHT_QUERY_PREFIX));
}

function getActionPosition(
    node: MemberCall,
    source: TSESLint.SourceCode,
    frameworks: UiFrameworks,
): number | undefined {
    const name = ASTUtils.getPropertyName(node.callee);
    const cypress = frameworks.hasCypress && isCypressChain(node.callee.object) ? CYPRESS_ACTIONS.get(name) : undefined;
    const playwright =
        frameworks.hasPlaywright && isLocator(node.callee.object, source) ? PLAYWRIGHT_ACTIONS.get(name) : undefined;
    return cypress ?? playwright;
}

export const noForcedUiActions = createRule<[], 'force'>({
    name: 'no-forced-ui-actions',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports `{ force: true }` on a Cypress action of a `cy` chain, such as `click` or `type`, in projects that depend on Cypress, and on a Playwright action of a locator, such as `click` or `fill`, in files that use Playwright.',
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
            hasPlaywright: usesModule(context, ['@playwright/test']),
        };
        if (!frameworks.hasCypress && !frameworks.hasPlaywright) return {};
        const source = context.sourceCode;
        return {
            'CallExpression[callee.type="MemberExpression"]'(node: MemberCall) {
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
