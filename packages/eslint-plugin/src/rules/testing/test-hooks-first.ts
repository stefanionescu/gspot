import { createRule } from '../../rule.ts';
import { getTestCall } from '../../libraries/testing.ts';
import type { SuiteMember } from '../../types/testing.ts';
import { TEST_AFTER_HOOK_NAMES, MARKED_TEST_MODIFIERS } from '../../config/testing.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function listMembers(body: TSESTree.Statement[], source: TSESLint.SourceCode): SuiteMember[] {
    const calls = body.flatMap((statement, index) =>
        statement.type === AST_NODE_TYPES.ExpressionStatement &&
        statement.expression.type === AST_NODE_TYPES.CallExpression
            ? [{ call: statement.expression, index }]
            : [],
    );
    return calls.flatMap(({ call, index }) => {
        const test = getTestCall(call, source);
        const isMarked = test?.modifiers.every((modifier) => MARKED_TEST_MODIFIERS.has(modifier)) === true;
        if (test === undefined || !isMarked) return [];
        return [{ call, index, kind: test.kind, isAfter: TEST_AFTER_HOOK_NAMES.has(test.name) }];
    });
}

function getSuiteBody(node: TSESTree.CallExpression, source: TSESLint.SourceCode): TSESTree.Statement[] {
    const suite = getTestCall(node, source);
    const isMarked = suite?.modifiers.every((modifier) => MARKED_TEST_MODIFIERS.has(modifier)) === true;
    const body = isMarked && suite.kind === 'suite' ? suite.callback?.body : undefined;
    return body?.type === AST_NODE_TYPES.BlockStatement ? body.body : [];
}

function listMisplacedHooks(members: SuiteMember[]): [TSESTree.CallExpression, 'before' | 'after' | 'group'][] {
    const tests = members.filter(({ kind }) => kind !== 'hook').map(({ index }) => index);
    const first = Math.min(...tests);
    const last = Math.max(...tests);
    const hooks = members.filter(({ kind }) => kind === 'hook');
    const misplaced = hooks.filter(({ index, isAfter }) => index > first && !(isAfter && index > last));
    const top = hooks.filter(({ index, isAfter }) => isAfter && index < first);
    const bottom = hooks.filter(({ index, isAfter }) => isAfter && index > last);
    const smaller = top.length < bottom.length ? top : bottom;
    return [
        ...misplaced.map(({ call, index, isAfter }): [TSESTree.CallExpression, 'before' | 'after'] => [
            call,
            isAfter && index < last ? 'after' : 'before',
        ]),
        ...smaller.map(({ call }): [TSESTree.CallExpression, 'group'] => [call, 'group']),
    ];
}

export const testHooksFirst = createRule<[], 'before' | 'after' | 'group'>({
    name: 'test-hooks-first',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports a lifecycle hook of a `describe` or `context` body that sits among or below its test cases and suites. An after hook may sit above or below them, but the after hooks of one suite stay in one group.',
            why: 'A reader expects the setup of a suite before its tests. A hook between tests runs for all of them, which its place hides.',
            fix: 'Move the before hooks above the first test of the suite, and keep the after hooks together above or below the tests.',
            example:
                '`describe("cart", () => { it("adds", run); beforeEach(reset); })` reports `before`. Move `beforeEach(reset)` above the `it` call.',
        },
        schema: [],
        messages: {
            before: 'Move this hook above the test cases in the same scope.',
            after: 'Move this hook above or below the test cases in the same scope.',
            group: 'Group this hook with the other after hooks in the same scope.',
        },
    },
    create(context) {
        return {
            CallExpression(node) {
                const members = listMembers(getSuiteBody(node, context.sourceCode), context.sourceCode);
                if (members.every(({ kind }) => kind === 'hook')) return;
                for (const [{ callee }, messageId] of listMisplacedHooks(members)) {
                    const node = callee.type === AST_NODE_TYPES.MemberExpression ? callee.object : callee;
                    context.report({ node, messageId });
                }
            },
        };
    },
});
