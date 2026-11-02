import { createRule } from '../rule.ts';
import { usesModule } from '../libraries/packages.ts';
import type { FunctionNode } from '../types/rules.ts';
import { findFunction } from '../language/functions.ts';
import { getTestCall, listBodyNodes } from '../libraries/testing.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { ASYNC_SUITE_MODULES, ASYNC_SUITE_ORIGINS, ASYNC_SUITE_MODIFIERS } from '../config/testing.ts';

function getSuiteCallback(node: TSESTree.CallExpression, source: TSESLint.SourceCode): FunctionNode | undefined {
    const call = getTestCall(node, source);
    const isSuite =
        call?.kind === 'suite' &&
        ASYNC_SUITE_ORIGINS.has(call.module) &&
        call.modifiers.every((modifier) => ASYNC_SUITE_MODIFIERS.has(modifier));
    if (!isSuite) return undefined;
    const functions = node.arguments.map((argument) => findFunction(argument, source));
    return call.callback ?? functions.find((callback) => callback !== undefined);
}

function findFirstAwait(callback: FunctionNode, source: TSESLint.SourceCode): TSESTree.Node | undefined {
    const nodes = listBodyNodes(callback.body, source);
    return nodes.find(
        (node) =>
            node.type === AST_NODE_TYPES.AwaitExpression || (node.type === AST_NODE_TYPES.ForOfStatement && node.await),
    );
}

function registersAfter(callback: FunctionNode, wait: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const offset = wait.type === AST_NODE_TYPES.ForOfStatement ? wait.range[0] : wait.range[1];
    const calls = listBodyNodes(callback.body, source).flatMap((node) =>
        node.type === AST_NODE_TYPES.ExpressionStatement &&
        node.expression.type === AST_NODE_TYPES.CallExpression &&
        node.range[0] >= offset
            ? [node.expression]
            : [],
    );
    return calls.some((call) => {
        const kind = getTestCall(call, source)?.kind;
        return kind === 'test' || kind === 'suite';
    });
}

function isDroppingFunction(call: TSESTree.CallExpression, source: TSESLint.SourceCode): boolean {
    const dropping = findFunction(call.callee, source);
    if (dropping?.async !== true) return false;
    const wait = findFirstAwait(dropping, source);
    return wait !== undefined && registersAfter(dropping, wait, source);
}

function getDroppingAwait(wait: TSESTree.Node | undefined, source: TSESLint.SourceCode): TSESTree.Node | undefined {
    const argument = wait?.type === AST_NODE_TYPES.AwaitExpression ? wait.argument : undefined;
    const isCall = argument?.type === AST_NODE_TYPES.CallExpression;
    return isCall && isDroppingFunction(argument, source) ? argument : undefined;
}

function listDroppingCalls(callback: FunctionNode, source: TSESLint.SourceCode): TSESTree.CallExpression[] {
    const expressions = listBodyNodes(callback.body, source).flatMap((node) =>
        node.type === AST_NODE_TYPES.ExpressionStatement ? [node.expression] : [],
    );
    const calls = expressions.map((expression) =>
        expression.type === AST_NODE_TYPES.AwaitExpression ? expression.argument : expression,
    );
    return calls.filter(
        (call): call is TSESTree.CallExpression =>
            call.type === AST_NODE_TYPES.CallExpression && isDroppingFunction(call, source),
    );
}

export const noAsyncSuiteCallbacks = createRule<
    [],
    'removeAsync' | 'awaitInSuite' | 'droppingHelper' | 'removeAsyncKeyword'
>({
    name: 'no-async-suite-callbacks',
    meta: {
        defaultOptions: [],
        type: 'problem',
        hasSuggestions: true,
        docs: {
            level: 'recommended',
            description:
                'Reports an async callback of `describe`, `context`, or `suite` in Jest, Mocha, and Cypress files: the `async` keyword when the callback awaits nothing, the first `await` otherwise, and a call of a local async function that declares tests after an `await`.',
            why: 'The runner collects the tests of a suite when it calls the callback, and it does not wait for a promise. A test declared after an `await` never runs, and nothing reports it.',
            fix: 'Make the suite callback synchronous. Move the async setup into a `beforeAll` or `beforeEach` hook, or into the test that needs it.',
            example:
                '`describe("cart", async () => { const user = await login(); it("adds", run); })` reports `awaitInSuite`. Write `let user; beforeAll(async () => { user = await login(); });` in the suite.',
        },
        schema: [],
        messages: {
            removeAsync: 'Remove the "async" keyword from this suite callback; a suite callback must be synchronous.',
            awaitInSuite:
                'Move this async setup into a hook or a test; the runner drops every test declared after this "await".',
            droppingHelper:
                'This async function drops the tests it declares after an "await". Make it synchronous, and move the async setup into a hook or a test.',
            removeAsyncKeyword: 'Remove the "async" keyword.',
        },
    },
    create(context) {
        if (!usesModule(context, ASYNC_SUITE_MODULES)) return {};
        const source = context.sourceCode;
        const reportKeyword = (callback: FunctionNode): void => {
            const token = source.getFirstToken(callback);
            const next = token && source.getTokenAfter(token);
            if (token?.value !== 'async' || !next) return;
            context.report({
                loc: token.loc,
                messageId: 'removeAsync',
                suggest: [
                    {
                        messageId: 'removeAsyncKeyword',
                        fix: (fixer) => fixer.removeRange([token.range[0], next.range[0]]),
                    },
                ],
            });
        };
        const reportAsync = (callback: FunctionNode): TSESTree.Node | undefined => {
            const wait = findFirstAwait(callback, source);
            const dropping = getDroppingAwait(wait, source);
            if (wait === undefined) reportKeyword(callback);
            else
                context.report({
                    node: dropping ?? wait,
                    messageId: dropping === undefined ? 'awaitInSuite' : 'droppingHelper',
                });
            return dropping;
        };
        return {
            CallExpression(node) {
                const callback = getSuiteCallback(node, source);
                if (callback === undefined) return;
                const reported = callback.async ? reportAsync(callback) : undefined;
                for (const call of listDroppingCalls(callback, source))
                    if (call !== reported) context.report({ node: call, messageId: 'droppingHelper' });
            },
        };
    },
});
