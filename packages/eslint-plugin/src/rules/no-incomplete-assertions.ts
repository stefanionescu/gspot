import { createRule } from '../rule.ts';
import type { AssertionFinding } from '../types/rules.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    EXPECT_ROOTS,
    ASSERTION_ROOTS,
    ASSERTION_WORDS,
    ASSERTION_METHODS,
    EXPECT_STATIC_METHODS,
} from '../config/assertions.ts';

function isExpectCall(node: TSESTree.Node): boolean {
    if (node.type !== AST_NODE_TYPES.CallExpression || !ASTUtils.isIdentifier(node.callee)) return false;
    const [first] = node.arguments;
    return (
        node.callee.name === 'expect' && !(first?.type === AST_NODE_TYPES.Literal && typeof first.value === 'number')
    );
}

function isExpectStatic(node: TSESTree.Node): boolean {
    if (node.type !== AST_NODE_TYPES.MemberExpression) return false;
    if (!EXPECT_STATIC_METHODS.has(ASTUtils.getPropertyName(node))) return false;
    return ASTUtils.isIdentifier(node.object) && node.object.name === 'expect';
}

function readNext(node: TSESTree.Node): TSESTree.Node | undefined {
    if (node.type === AST_NODE_TYPES.MemberExpression) return node.object;
    return node.type === AST_NODE_TYPES.CallExpression ? node.callee : undefined;
}

function isAssertionRoot(node: TSESTree.Node, roots: ReadonlySet<string>): boolean {
    const isRootName = ASTUtils.isIdentifier(node) && roots.has(node.name);
    const isPropertyAssertion =
        node.type === AST_NODE_TYPES.MemberExpression &&
        ASTUtils.isIdentifier(node.object) &&
        ASTUtils.getPropertyName(node) === 'should';
    return (
        isRootName ||
        isPropertyAssertion ||
        isExpectCall(node) ||
        (node.type === AST_NODE_TYPES.CallExpression && isExpectStatic(node.callee))
    );
}

function isAssertionChain(node: TSESTree.Node, roots: ReadonlySet<string>): boolean {
    for (let value: TSESTree.Node | undefined = node; value !== undefined; value = readNext(value))
        if (isAssertionRoot(value, roots)) return true;
    return false;
}

function readIncomplete(node: TSESTree.Node): AssertionFinding | undefined {
    if (node.type !== AST_NODE_TYPES.MemberExpression || !isAssertionChain(node, ASSERTION_ROOTS)) return undefined;
    const name = ASTUtils.getPropertyName(node);
    const isRejects = name === 'rejects' && isAssertionChain(node.object, EXPECT_ROOTS);
    if (ASSERTION_METHODS.has(name) && !isRejects) return [node.property, 'call'];
    return ASSERTION_WORDS.has(name) ? [node.property, 'complete'] : undefined;
}

function listIncomplete(node: TSESTree.Node): AssertionFinding[] {
    const callee = node.type === AST_NODE_TYPES.CallExpression ? node.callee : node;
    const property = callee.type === AST_NODE_TYPES.MemberExpression ? callee.property : undefined;
    if (isExpectCall(node)) return [[callee, 'complete']];
    if (property !== undefined && isExpectStatic(callee)) return [[property, 'complete']];
    const incomplete = node === callee ? readIncomplete(node) : undefined;
    return incomplete === undefined ? [] : [incomplete];
}

export const noIncompleteAssertions = createRule<[], 'complete' | 'call'>({
    name: 'no-incomplete-assertions',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a statement that starts an assertion and stops before it asserts: `expect(value)` alone, a chain of `expect`, `assert`, or `should` that ends on a word such as `to` or `be`, a matcher such as `equal` that the statement does not call, and `expect.soft` or `expect.poll` alone.',
            why: 'An assertion that is never called checks nothing, and the test passes whatever the value is.',
            fix: 'Finish the assertion with the matcher that checks the value, and call it.',
            example: '`expect(total).to.equal;` reports `call`. Write `expect(total).to.equal(3);`.',
        },
        schema: [],
        messages: {
            complete: "Complete this assertion; '{{name}}' does not assert anything by itself.",
            call: "Call this '{{name}}' assertion.",
        },
    },
    create(context) {
        return {
            ExpressionStatement({ expression }) {
                const node = expression.type === AST_NODE_TYPES.AwaitExpression ? expression.argument : expression;
                for (const [reported, messageId] of listIncomplete(node)) {
                    context.report({ node: reported, messageId, data: { name: context.sourceCode.getText(reported) } });
                }
            },
        };
    },
});
