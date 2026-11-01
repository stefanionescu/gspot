import { createRule } from '../rule.ts';
import { readTestCall } from '../testing.ts';
import { readModuleName } from '../modules.ts';
import type { TypeReader } from '../types/plugin.ts';
import { readTypes, isThenable } from '../checker.ts';
import type { ThrowAssertion } from '../types/rules.ts';
import { THROW_EXPECTS, UNCERTAIN_TYPES } from '../config/matchers.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function readThrowExpect(
    callee: TSESTree.MemberExpression,
    source: TSESLint.SourceCode,
): TSESTree.CallExpression | undefined {
    const { object } = callee;
    const expect =
        object.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(object) === 'not'
            ? object.object
            : object;
    const isExpect =
        expect.type === AST_NODE_TYPES.CallExpression && THROW_EXPECTS.has(readModuleName(expect.callee, source) ?? '');
    return isExpect ? expect : undefined;
}

function readThrowAssertion(
    node: TSESTree.CallExpression & { callee: TSESTree.MemberExpression },
    source: TSESLint.SourceCode,
): ThrowAssertion | undefined {
    const { callee, parent } = node;
    const expect = readThrowExpect(callee, source);
    const received = expect?.arguments
        .slice(0, 1)
        .find((argument): argument is TSESTree.Expression => argument.type !== AST_NODE_TYPES.SpreadElement);
    const target = callee.object.type === AST_NODE_TYPES.MemberExpression ? callee.object.property : callee.property;
    const isChained = parent.type === AST_NODE_TYPES.MemberExpression || parent.type === AST_NODE_TYPES.CallExpression;
    if (isChained || expect === undefined || received === undefined) return undefined;
    return { expect, received, target, matcher: source.getText(callee.property) };
}

function isNonCallable(types: TypeReader, node: TSESTree.Node): boolean {
    const type = types.read(node);
    const members = type.isUnion() ? type.types : [type];
    return members.every(
        (member) =>
            member.getCallSignatures().length === 0 &&
            types.checker.getBaseConstraintOfType(member) === undefined &&
            !UNCERTAIN_TYPES.has(types.checker.typeToString(member)) &&
            !member.isTypeParameter(),
    );
}

function isAsyncTest(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const callback = source.getAncestors(node).findLast((ancestor) => ASTUtils.isFunction(ancestor));
    const test =
        callback?.parent.type === AST_NODE_TYPES.CallExpression ? readTestCall(callback.parent, source) : undefined;
    const tested = test?.callback;
    return tested !== undefined && tested === callback && tested.async && tested.params.length === 0;
}

function readRejectionFix(
    assertion: ThrowAssertion,
    node: TSESTree.CallExpression,
    source: TSESLint.SourceCode,
): TSESLint.ReportSuggestionArray<'rejection'> {
    const received = source.getText(assertion.received);
    const isStatement = node.parent.type === AST_NODE_TYPES.ExpressionStatement;
    if (!isStatement || !isAsyncTest(node, source)) return [];
    return [
        {
            messageId: 'rejection',
            fix: (fixer) => [
                fixer.insertTextBefore(assertion.expect, 'await '),
                fixer.replaceText(assertion.received, `(${received})()`),
                fixer.insertTextBefore(assertion.target, 'rejects.'),
            ],
        },
    ];
}

function readWrapFix(
    assertion: ThrowAssertion,
    types: TypeReader,
    source: TSESLint.SourceCode,
): TSESLint.ReportSuggestionArray<'wrap'> {
    const { received } = assertion;
    const isCall = received.type === AST_NODE_TYPES.CallExpression || received.type === AST_NODE_TYPES.NewExpression;
    if (!isCall || isThenable(types, received)) return [];
    return [{ messageId: 'wrap', fix: (fixer) => fixer.replaceText(received, `() => ${source.getText(received)}`) }];
}

export const validThrowAssertions = createRule<[], 'async' | 'value' | 'rejection' | 'wrap'>({
    name: 'valid-throw-assertions',
    meta: {
        defaultOptions: [],
        type: 'problem',
        hasSuggestions: true,
        docs: {
            level: 'recommended',
            description:
                'Reports `toThrow` and `toThrowError` assertions of the `expect` that Jest, Vitest, or Bun export when the value passed to `expect` is an async function, or, with the type information of a TypeScript project, a value that is not a function, such as the result of a call.',
            why: 'The matcher calls the function and catches what it throws while it runs. An async function returns a rejected promise instead of throwing, and a value that is not a function has already thrown, or never will, before the matcher runs.',
            fix: 'Wrap the code in a function, such as `expect(() => parse(text)).toThrow()`. For an async function, assert the rejection: `await expect(load()).rejects.toThrow()`.',
            example: '`expect(parse(text)).toThrow()` reports `value`. Write `expect(() => parse(text)).toThrow()`.',
        },
        schema: [],
        messages: {
            async: 'This assertion only catches an exception thrown while the function runs; assert the rejection of the async function instead.',
            value: '`{{matcher}}` only catches an exception that a function it calls throws. Wrap the code that throws in a function.',
            rejection: 'Assert the rejection with `await expect(...).rejects`.',
            wrap: 'Wrap the code in a function.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const types = readTypes(context);
        return {
            'CallExpression[callee.type="MemberExpression"][callee.property.name=/^toThrow(?:Error)?$/]'(
                node: TSESTree.CallExpression & { callee: TSESTree.MemberExpression },
            ) {
                const assertion = readThrowAssertion(node, source);
                if (assertion === undefined) return;
                const { received } = assertion;
                const isAsync =
                    (received.type === AST_NODE_TYPES.ArrowFunctionExpression ||
                        received.type === AST_NODE_TYPES.FunctionExpression) &&
                    received.async &&
                    !received.generator;
                if (isAsync) {
                    context.report({
                        node: received,
                        messageId: 'async',
                        suggest: readRejectionFix(assertion, node, source),
                    });
                    return;
                }
                if (types !== undefined && isNonCallable(types, received))
                    context.report({
                        node: received,
                        messageId: 'value',
                        data: { matcher: assertion.matcher },
                        suggest: readWrapFix(assertion, types, source),
                    });
            },
        };
    },
});
