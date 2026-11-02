import { createRule } from '../../rule.ts';
import { readAssertion } from '../../libraries/assertions.ts';
import { ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import type { Assertion, AssertedValue, ConstantFinding } from '../../types/rules.ts';
import { FRESH_VALUES, DEEP_MATCHERS, IDENTITY_STYLES, FRESH_PREDICATES } from '../../config/assertions/styles.ts';

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
    const usesIdentity = assertion.comparison === 'strict' && IDENTITY_STYLES.has(assertion.style);
    const areNullish = assertion.comparison === 'loose' && (left ?? null) === null && (right ?? null) === null;
    return usesIdentity ? Object.is(left, right) : left === right || areNullish;
}

function getIdentityFinding(
    assertion: Assertion & { kind: 'comparison' },
    source: TSESLint.SourceCode,
): ConstantFinding | undefined {
    const fresh = [assertion.received, assertion.expected].find((value) => getValue(value, source).isFresh);
    const [positive, negative] = DEEP_MATCHERS[assertion.style];
    if (assertion.comparison !== 'strict' || fresh === undefined) return undefined;
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
                'Reports an assertion of Jest, Vitest, Bun, Jasmine, Playwright, chai, or node:assert whose result does not depend on the code under test: a predicate or an equality on constant values, a predicate on a value created in place, and an identity check against an array, object, function, class, regular expression, or `new` value created in place.',
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
            'CallExpression, MemberExpression'(node: TSESTree.CallExpression | TSESTree.MemberExpression) {
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
