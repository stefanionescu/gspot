import { createRule } from '../rule.ts';
import { readTestCall, listBodyNodes } from '../testing.ts';
import { MOCHA_CONSTRUCTS, MARKED_TEST_MODIFIERS } from '../config/testing.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function isInsideTest(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    return source.getAncestors(node).some((ancestor) => {
        const call = ancestor.type === AST_NODE_TYPES.CallExpression ? readTestCall(ancestor, source) : undefined;
        const isMarked = call?.modifiers.every((modifier) => MARKED_TEST_MODIFIERS.has(modifier)) === true;
        return isMarked && MOCHA_CONSTRUCTS.has(call.name);
    });
}

function isPositiveThrowAssertion(node: TSESTree.CallExpression & { callee: TSESTree.MemberExpression }): boolean {
    let value = node.callee.object;
    while (value.type === AST_NODE_TYPES.MemberExpression) {
        const name = ASTUtils.getPropertyName(value);
        if (name === 'not' || name === 'should') return name === 'should';
        value = value.object;
    }
    return (
        value.type === AST_NODE_TYPES.CallExpression &&
        ASTUtils.isIdentifier(value.callee) &&
        value.callee.name === 'expect'
    );
}

export const requireErrorChecks = createRule<[], 'errorType' | 'ignoredError'>({
    name: 'require-error-checks',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports, inside a Mocha `describe`, `it`, or hook: a chai `expect(...).to.throw()` or `should.throw()` that names no error or only `Error`, and a `catch` parameter that nothing reads in a block that calls `done`.',
            why: 'Any error passes an assertion that expects just an error, so a test written for one failure also passes on a typo or a crash.',
            fix: 'Name the error type or its message in the assertion, and pass the caught error to `done(error)` or check it.',
            example:
                '`expect(run).to.throw();` reports `errorType`. Write `expect(run).to.throw(RangeError, "negative amount");`.',
        },
        schema: [],
        messages: {
            errorType: 'Assert a more concrete error type, or assert the message of the error.',
            ignoredError: 'Pass the error to "done(error)", or check the error further.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'CallExpression[callee.type="MemberExpression"][callee.property.name="throw"]'(
                node: TSESTree.CallExpression & { callee: TSESTree.MemberExpression },
            ) {
                const [first, ...rest] = node.arguments;
                const isVague =
                    first === undefined ||
                    (rest.length === 0 && ASTUtils.isIdentifier(first) && first.name === 'Error');
                if (isVague && isPositiveThrowAssertion(node) && isInsideTest(node, source))
                    context.report({ node: node.callee.property, messageId: 'errorType' });
            },
            'CatchClause[param.type="Identifier"]'(node: TSESTree.CatchClause & { param: TSESTree.Identifier }) {
                const callsDone = listBodyNodes(node.body, source).some(
                    (each) =>
                        each.type === AST_NODE_TYPES.CallExpression &&
                        ASTUtils.isIdentifier(each.callee) &&
                        each.callee.name === 'done',
                );
                const error = ASTUtils.findVariable(source.getScope(node.body), node.param);
                if (callsDone && error?.references.length === 0 && isInsideTest(node, source))
                    context.report({ node: node.param, messageId: 'ignoredError' });
            },
        };
    },
});
