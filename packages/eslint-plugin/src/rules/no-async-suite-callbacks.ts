import { createRule } from '../rule.ts';
import { readLocalFunction } from '../functions.ts';
import type { LocalFunction } from '../types/plugin.ts';
import { usesModule, readTestCall, listBodyNodes } from '../testing.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { ASYNC_SUITE_MODULES, ASYNC_SUITE_ORIGINS, ASYNC_SUITE_MODIFIERS } from '../config/testing.ts';

function readSuiteCallback(node: TSESTree.CallExpression, source: TSESLint.SourceCode): LocalFunction | undefined {
    const call = readTestCall(node, source);
    const isSuite =
        call?.kind === 'suite' &&
        ASYNC_SUITE_ORIGINS.has(call.module) &&
        call.modifiers.every((modifier) => ASYNC_SUITE_MODIFIERS.has(modifier));
    if (!isSuite) return undefined;
    const functions = node.arguments.map((argument) => readLocalFunction(argument, source));
    return call.callback ?? functions.find((callback) => callback?.body !== undefined);
}

function findFirstAwait(callback: LocalFunction, source: TSESLint.SourceCode): TSESTree.Node | undefined {
    const nodes = callback.body === undefined ? [] : listBodyNodes(callback.body, source);
    const waits = nodes.filter(
        (node) =>
            node.type === AST_NODE_TYPES.AwaitExpression || (node.type === AST_NODE_TYPES.ForOfStatement && node.await),
    );
    return waits.toSorted((left, right) => left.range[0] - right.range[0])[0];
}

function registersAfter(callback: LocalFunction, wait: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const offset = wait.type === AST_NODE_TYPES.ForOfStatement ? wait.range[0] : wait.range[1];
    const nodes = callback.body?.type === AST_NODE_TYPES.BlockStatement ? listBodyNodes(callback.body, source) : [];
    const calls = nodes.flatMap((node) =>
        node.type === AST_NODE_TYPES.ExpressionStatement &&
        node.expression.type === AST_NODE_TYPES.CallExpression &&
        node.range[0] >= offset
            ? [node.expression]
            : [],
    );
    return calls.some((call) => {
        const kind = readTestCall(call, source)?.kind;
        return kind === 'test' || kind === 'suite';
    });
}

function isDroppingFunction(call: TSESTree.CallExpression, source: TSESLint.SourceCode): boolean {
    const dropping = readLocalFunction(call.callee, source);
    if (dropping?.async !== true) return false;
    const wait = findFirstAwait(dropping, source);
    return wait !== undefined && registersAfter(dropping, wait, source);
}

function readDroppingAwait(wait: TSESTree.Node | undefined, source: TSESLint.SourceCode): TSESTree.Node | undefined {
    const argument = wait?.type === AST_NODE_TYPES.AwaitExpression ? wait.argument : undefined;
    const isCall = argument?.type === AST_NODE_TYPES.CallExpression;
    return isCall && isDroppingFunction(argument, source) ? argument : undefined;
}

function listDroppingCalls(callback: LocalFunction, source: TSESLint.SourceCode): TSESTree.CallExpression[] {
    const nodes = callback.body === undefined ? [] : listBodyNodes(callback.body, source);
    const expressions = nodes.flatMap((node) =>
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
        const reportKeyword = (callback: LocalFunction): void => {
            const token = source.getFirstToken(callback);
            if (token?.value !== 'async') return;
            const end = source.getTokenAfter(token)?.range[0] ?? token.range[1];
            context.report({
                loc: token.loc,
                messageId: 'removeAsync',
                suggest: [
                    { messageId: 'removeAsyncKeyword', fix: (fixer) => fixer.removeRange([token.range[0], end]) },
                ],
            });
        };
        const reportAsync = (callback: LocalFunction): TSESTree.Node | undefined => {
            const wait = findFirstAwait(callback, source);
            const dropping = readDroppingAwait(wait, source);
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
                const callback = readSuiteCallback(node, source);
                if (callback === undefined) return;
                const reported = callback.async ? reportAsync(callback) : undefined;
                for (const call of listDroppingCalls(callback, source))
                    if (call !== reported) context.report({ node: call, messageId: 'droppingHelper' });
            },
        };
    },
});
