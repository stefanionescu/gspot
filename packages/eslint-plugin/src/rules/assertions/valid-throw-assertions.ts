import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { THROW_EXPECTS, UNCERTAIN_TYPES } from '../../config/assertions/matchers.ts';
import { getTypes, isThenable } from '../../language/checker.ts';
import { findEnclosingFunction } from '../../language/functions.ts';
import { getModuleName } from '../../language/modules.ts';
import { getEnclosingTestCall } from '../../libraries/testing.ts';
import { createRule } from '../../rule.ts';
import type { ThrowAssertion } from '../../types/assertions.ts';
import type { TypeReader } from '../../types/plugin.ts';

function getThrowExpect(
    callee: TSESTree.MemberExpression,
    source: TSESLint.SourceCode,
): TSESTree.CallExpression | undefined {
    const { object } = callee;
    const expect =
        object.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(object) === 'not'
            ? object.object
            : object;
    const isExpect =
        expect.type === AST_NODE_TYPES.CallExpression && THROW_EXPECTS.has(getModuleName(expect.callee, source));
    return isExpect ? expect : undefined;
}

function getThrowAssertion(
    node: TSESTree.CallExpression & { callee: TSESTree.MemberExpression },
    source: TSESLint.SourceCode,
): ThrowAssertion | undefined {
    const { callee, parent } = node;
    const expect = getThrowExpect(callee, source);
    const received = expect?.arguments
        .slice(0, 1)
        .find((argument): argument is TSESTree.Expression => argument.type !== AST_NODE_TYPES.SpreadElement);
    const target = callee.object.type === AST_NODE_TYPES.MemberExpression ? callee.object.property : callee.property;
    const isChained = parent.type === AST_NODE_TYPES.MemberExpression || parent.type === AST_NODE_TYPES.CallExpression;
    return isChained || expect === undefined || received === undefined
        ? undefined
        : { expect, received, target, matcher: source.getText(callee.property) };
}

function isNonCallable(types: TypeReader, node: TSESTree.Node): boolean {
    const type = types.get(node);
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
    const callback = findEnclosingFunction(node, source);
    const tested = getEnclosingTestCall(node, source)?.callback;
    return tested !== undefined && tested === callback && tested.async && tested.params.length === 0;
}

function getRejectionFix(
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

function getWrapFix(
    assertion: ThrowAssertion,
    types: TypeReader,
    source: TSESLint.SourceCode,
): TSESLint.ReportSuggestionArray<'wrap'> {
    const { received } = assertion;
    const isCall = received.type === AST_NODE_TYPES.CallExpression || received.type === AST_NODE_TYPES.NewExpression;
    return !isCall || isThenable(types, received)
        ? []
        : [{ messageId: 'wrap', fix: (fixer) => fixer.replaceText(received, `() => ${source.getText(received)}`) }];
}

function checkThrowAssertion(
    context: Readonly<TSESLint.RuleContext<'async' | 'value' | 'rejection' | 'wrap', []>>,
    node: TSESTree.CallExpression & { callee: TSESTree.MemberExpression },
    types: TypeReader | undefined,
): void {
    const source = context.sourceCode;
    const assertion = getThrowAssertion(node, source);
    if (assertion === undefined) return;
    const { received } = assertion;
    const isAsync =
        (received.type === AST_NODE_TYPES.ArrowFunctionExpression ||
            received.type === AST_NODE_TYPES.FunctionExpression) &&
        received.async &&
        !received.generator;
    if (isAsync)
        context.report({ node: received, messageId: 'async', suggest: getRejectionFix(assertion, node, source) });
    else if (types !== undefined && isNonCallable(types, received))
        context.report({
            node: received,
            messageId: 'value',
            data: { matcher: assertion.matcher },
            suggest: getWrapFix(assertion, types, source),
        });
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
                'Reports a `toThrow` or `toThrowError` assertion whose `expect` value is an async function, or, with type information, a value that is not a function, such as the result of a call.',
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
        const types = getTypes(context);
        return {
            'CallExpression[callee.type="MemberExpression"][callee.property.name=/^toThrow(?:Error)?$/]': (
                node: TSESTree.CallExpression & { callee: TSESTree.MemberExpression },
            ) => {
                checkThrowAssertion(context, node, types);
            },
        };
    },
});
