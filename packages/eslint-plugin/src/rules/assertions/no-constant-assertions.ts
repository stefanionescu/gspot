import { createRule } from '../../rule.ts';
import { readAssertion } from '../../libraries/assertions.ts';
import { ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import type { Assertion, AssertedValue, ConstantFinding } from '../../types/assertions.ts';
import { FRESH_VALUES, DEEP_MATCHERS, IDENTITY_STYLES, FRESH_PREDICATES } from '../../config/assertions/matchers.ts';

function getValue(node: TSESTree.Node, source: TSESLint.SourceCode): AssertedValue {
    const evaluated = ASTUtils.getStaticValue(node, source.getScope(node));
    const value: unknown = evaluated?.value;
    const isFresh = FRESH_VALUES.has(node.type) || value instanceof RegExp;
    return { isFresh, isConstant: !isFresh && evaluated !== null && Object(value) !== value, value };
}

function isPredicateMet(assertion: Assertion & { kind: 'predicate' }, value: unknown): boolean {
    const isTruthy = Boolean(value);
    const isNullish = value === null || value === undefined;
    const results = {
        truthy: isTruthy,
        falsy: !isTruthy,
        true: value === true,
        false: value === false,
        defined: value !== undefined,
        undefined: value === undefined,
        null: value === null,
        exists: !isNullish,
    };
    return results[assertion.predicate] !== assertion.negated;
}

function getPredicateFinding(
    assertion: Assertion & { kind: 'predicate' },
    source: TSESLint.SourceCode,
): ConstantFinding | undefined {
    const { isFresh, isConstant, value } = getValue(assertion.received, source);
    if (isFresh && FRESH_PREDICATES.has(assertion.predicate) !== assertion.negated)
        return { node: assertion.received, messageId: 'fresh' };
    return isConstant && isPredicateMet(assertion, value)
        ? { node: assertion.received, messageId: 'constant' }
        : undefined;
}

function areEqual(left: unknown, right: unknown, assertion: Assertion & { kind: 'comparison' }): boolean {
    const isIdentityComparison = assertion.comparison === 'strict' && IDENTITY_STYLES.has(assertion.style);
    const isBothNullish = assertion.comparison === 'loose' && (left ?? null) === null && (right ?? null) === null;
    return isIdentityComparison ? Object.is(left, right) : left === right || isBothNullish;
}

function getIdentityFinding(
    assertion: Assertion & { kind: 'comparison' },
    source: TSESLint.SourceCode,
): ConstantFinding | undefined {
    const fresh = [assertion.received, assertion.expected].find((value) => getValue(value, source).isFresh);
    const [positive, negative] = DEEP_MATCHERS[assertion.style];
    if (fresh === undefined || assertion.comparison !== 'strict') return undefined;
    return { node: fresh, messageId: 'identity', matcher: assertion.negated ? negative : positive };
}

function getComparisonFinding(
    assertion: Assertion & { kind: 'comparison' },
    source: TSESLint.SourceCode,
): ConstantFinding | undefined {
    const identity = getIdentityFinding(assertion, source);
    if (identity !== undefined || assertion.comparison === 'deep') return identity;
    const left = getValue(assertion.received, source);
    const right = getValue(assertion.expected, source);
    const isAlways =
        left.isConstant && right.isConstant && areEqual(left.value, right.value, assertion) !== assertion.negated;
    return isAlways ? { node: assertion.received, messageId: 'constant' } : undefined;
}

export const noConstantAssertions = createRule<[], 'constant' | 'fresh' | 'identity'>({
    name: 'no-constant-assertions',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports an assertion whose result does not depend on the code under test, such as an equality of two constants or an identity check against an object created in place.',
            why: 'An assertion that always passes, or always fails for a reason the test cannot change, checks nothing about the code.',
            fix: 'Assert the value that the code under test returns. Compare a new object or array with a deep equality matcher.',
            example: '`expect(true).toBe(true)` reports `constant`. Write `expect(isReady()).toBe(true)`.',
        },
        schema: [],
        messages: {
            constant: 'Replace this assertion; it always succeeds.',
            fresh: 'Replace this assertion; the value is created here, so the result does not depend on the code under test.',
            identity: 'Use `{{matcher}}` instead; a value created here is never identical to another value.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'CallExpression, MemberExpression': function (node: TSESTree.CallExpression | TSESTree.MemberExpression) {
                const assertion = readAssertion(node, context);
                if (assertion === undefined) return;
                const finding =
                    assertion.kind === 'predicate'
                        ? getPredicateFinding(assertion, source)
                        : getComparisonFinding(assertion, source);
                if (finding !== undefined)
                    context.report({
                        node: finding.node,
                        messageId: finding.messageId,
                        data: { matcher: finding.matcher ?? '' },
                    });
            },
        };
    },
});
