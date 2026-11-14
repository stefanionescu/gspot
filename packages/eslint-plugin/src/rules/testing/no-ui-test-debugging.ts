import { createRule } from '../../rule.ts';
import { getModuleName } from '../../language/modules.ts';
import { isCypressChain, isTestRelatedPath } from '../../libraries/testing.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    DEBUG_ROOTS,
    DEBUG_METHODS,
    TESTING_LIBRARY_MODULES,
    TESTING_LIBRARY_DEBUGGERS,
} from '../../config/testing.ts';

function isTestingLibraryDebugger(callee: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const name = getModuleName(callee, source) ?? '';
    const module = TESTING_LIBRARY_MODULES.find((each) => name.startsWith(`${each}.`));
    return module !== undefined && TESTING_LIBRARY_DEBUGGERS.some((command) => name.endsWith(`.${command}`));
}

function isDebugCommand(callee: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    if (callee.type !== AST_NODE_TYPES.MemberExpression) return isTestingLibraryDebugger(callee, source);
    const receiver = callee.object;
    const kinds = new Set([
        ...(isCypressChain(receiver) ? ['cypress'] : []),
        ...(ASTUtils.isIdentifier(receiver) && receiver.name === 'page' ? ['page'] : []),
        ...(isTestingLibraryDebugger(callee, source) ? ['library'] : []),
    ]);
    return (DEBUG_METHODS.get(ASTUtils.getPropertyName(callee)) ?? []).some((kind) => kinds.has(kind));
}

function getRemoval(node: TSESTree.CallExpression): [number, number] | undefined {
    const receiver = node.callee.type === AST_NODE_TYPES.MemberExpression ? node.callee.object : undefined;
    const isRoot = receiver === undefined || (ASTUtils.isIdentifier(receiver) && DEBUG_ROOTS.has(receiver.name));
    if (!isRoot) return [receiver.range[1], node.range[1]];
    const statement = node.parent.type === AST_NODE_TYPES.AwaitExpression ? node.parent.parent : node.parent;
    return statement.type === AST_NODE_TYPES.ExpressionStatement ? statement.range : undefined;
}

export const noUiTestDebugging = createRule<[], 'debug'>({
    name: 'no-ui-test-debugging',
    meta: {
        defaultOptions: [],
        type: 'problem',
        fixable: 'code',
        docs: {
            level: 'recommended',
            description:
                'Reports debug commands in test-related files: `cy.pause()`, `cy.debug()`, and `.pause()` and `.debug()` on a Cypress chain, Playwright `page.pause()`, and the Testing Library `screen.debug()`, `screen.logTestingPlaygroundURL()`, `debug()` from `render()`, `prettyDOM()`, and `logRoles()`. The fix deletes the command.',
            why: 'A debug command stops a run to wait for a person or floods the log. Left in a test, it blocks CI or hides the output that matters.',
            fix: 'Delete the command before you commit.',
            example: '`cy.get("button").debug().click();` reports `debug`. The fix writes `cy.get("button").click();`.',
        },
        schema: [],
        messages: { debug: 'Remove this debug command from the test.' },
    },
    create(context) {
        if (!isTestRelatedPath(context.filename)) return {};
        return {
            CallExpression(node) {
                if (!isDebugCommand(node.callee, context.sourceCode)) return;
                const removal = getRemoval(node);
                const reported =
                    node.callee.type === AST_NODE_TYPES.MemberExpression ? node.callee.property : node.callee;
                context.report({
                    node: reported,
                    messageId: 'debug',
                    fix: (fixer) => (removal === undefined ? null : fixer.removeRange(removal)),
                });
            },
        };
    },
});
