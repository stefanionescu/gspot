import { createRule } from '../../rule.ts';
import { getTestCall } from '../../libraries/testing.ts';
import type { FileContext } from '../../types/plugin.ts';
import { isModuleUsed } from '../../libraries/packages.ts';
import type { PlacementState } from '../../types/assertions.ts';
import { readAssertionKind } from '../../libraries/assertions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { STATEMENT_LINKS, EVIDENCE_IMPORTS, EVIDENCE_DEPENDENCIES } from '../../config/assertions/evidence.ts';

function isStatementLink(parent: TSESTree.Node, child: TSESTree.Node): boolean {
    const isReceiver = parent.type === AST_NODE_TYPES.MemberExpression && parent.object === child;
    const isCallee = parent.type === AST_NODE_TYPES.CallExpression && parent.callee === child;
    return STATEMENT_LINKS.has(parent.type) || isReceiver || isCallee;
}

function getStatement(node: TSESTree.CallExpression): TSESTree.ExpressionStatement | undefined {
    let child: TSESTree.Node = node;
    let parent: TSESTree.Node | undefined = node.parent;
    while (parent !== undefined && isStatementLink(parent, child)) {
        child = parent;
        parent = parent.parent;
    }
    return parent?.type === AST_NODE_TYPES.ExpressionStatement ? parent : undefined;
}

function getPlacement(node: TSESTree.Node, source: TSESLint.SourceCode): 'top' | 'suite' | 'function' {
    const callback = source.getAncestors(node).findLast((ancestor) => ASTUtils.isFunction(ancestor));
    const owner =
        callback?.parent.type === AST_NODE_TYPES.CallExpression ? getTestCall(callback.parent, source) : undefined;
    if (callback === undefined) return 'top';
    return owner?.kind === 'suite' ? 'suite' : 'function';
}

function trackAssertion(node: TSESTree.CallExpression, context: FileContext, state: PlacementState): void {
    const kind = readAssertionKind(node, context);
    const statement = kind === undefined || kind === 'type' ? undefined : getStatement(node);
    if (statement === undefined) return;
    const placement = getPlacement(node, context.sourceCode);
    if (placement === 'suite') state.reported.add(statement);
    else if (placement === 'top')
        state.topLevel.set(statement, state.topLevel.get(statement) === true || kind === 'script');
}

export const noMisplacedAssertions = createRule<[], 'misplaced'>({
    name: 'no-misplaced-assertions',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports an assertion statement that runs in the callback of a suite such as `describe`, or at the top of a file that declares tests, instead of inside a test.',
            why: 'A suite callback runs while the runner collects the tests, and the top of a file runs when the runner loads it, so a failure there aborts the whole file instead of failing one test, or runs before the setup that the tests need.',
            fix: 'Move the assertion into a test, or into a hook such as `beforeEach`.',
            example:
                '`describe("cart", () => { expect(cart.items).toHaveLength(0); })` reports `misplaced`. Move the assertion into an `it` callback.',
        },
        schema: [],
        messages: { misplaced: 'Move this assertion into a test or a lifecycle hook.' },
    },
    create(context) {
        const source = context.sourceCode;
        if (!isModuleUsed(context, EVIDENCE_IMPORTS, EVIDENCE_DEPENDENCIES)) return {};
        const state: PlacementState = { reported: new Set(), topLevel: new Map(), hasTests: false };
        return {
            CallExpression(node) {
                const test = getTestCall(node, source);
                state.hasTests ||= test !== undefined && test.kind !== 'hook';
                trackAssertion(node, context, state);
            },
            'Program:exit'() {
                for (const [statement, isScript] of state.topLevel)
                    if (!isScript || state.hasTests) state.reported.add(statement);
                for (const statement of state.reported) context.report({ node: statement, messageId: 'misplaced' });
            },
        };
    },
});
