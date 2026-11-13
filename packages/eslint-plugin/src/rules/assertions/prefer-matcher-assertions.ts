import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import {
    ASSERT_MESSAGE_INDEX,
    BARE_RECEIVERS,
    BOOLEAN_KINDS,
    INVERTED_OPERATORS,
    JASMINE_SIZE_VERSION,
    JASMINE_VERSION_PACKAGES,
    LOCATOR_STATES,
    LOCATOR_VALUES,
    MATCHER_FAMILIES,
    MATCHER_TEMPLATES,
    NULLISH_KINDS,
    NUMERIC_MATCHERS,
    NUMERIC_NAME,
    OPERAND_KINDS,
    STRICT_EQUALITY_OPERATORS,
    TEMPLATE_FIELD,
    TEXT_RECEIVER,
    VALUE_KINDS,
} from '../../config/assertions/matchers.ts';
import { NUMERIC_SIGNS, NUMERIC_VALUE_TYPES } from '../../config/plugin.ts';
import { PLAYWRIGHT_LOCATOR } from '../../config/testing.ts';
import { readPackageFacts } from '../../language/packages.ts';
import { requiresVersion } from '../../language/versions.ts';
import { readAssertion } from '../../libraries/assertions.ts';
import { createRule } from '../../rule.ts';
import type { ComparisonAssertion, MatcherSuggestion } from '../../types/assertions.ts';
import type { FileContext } from '../../types/plugin.ts';

function getOperand(node: TSESTree.Node, source: TSESLint.SourceCode): string {
    const text = source.getText(node);
    const isLength =
        node.type === AST_NODE_TYPES.MemberExpression && !node.computed && ASTUtils.getPropertyName(node) === 'length';
    return isLength ? 'length' : (OPERAND_KINDS.get(text) ?? 'other');
}

function isNumeric(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const value =
        node.type === AST_NODE_TYPES.UnaryExpression && NUMERIC_SIGNS.has(node.operator) ? node.argument : node;
    const isNumber = value.type === AST_NODE_TYPES.Literal && NUMERIC_VALUE_TYPES.has(typeof value.value);
    return isNumber || NUMERIC_NAME.test(source.getText(value));
}

function getEqualitySuggestion(
    left: TSESTree.Node,
    right: TSESTree.Node,
    { isNegated, source }: { isNegated: boolean; source: TSESLint.SourceCode },
): MatcherSuggestion {
    const sides = [
        { received: left, expected: right },
        { received: right, expected: left },
    ];
    const nullish = sides.find(({ expected }) => NULLISH_KINDS.has(getOperand(expected, source)));
    const length = sides.find(({ received }) => getOperand(received, source) === 'length');
    if (nullish !== undefined)
        return { kind: getOperand(nullish.expected, source), received: nullish.received, negated: isNegated };
    return length?.received.type === AST_NODE_TYPES.MemberExpression
        ? { kind: 'length', received: length.received.object, expected: length.expected, negated: isNegated }
        : { kind: 'equal', received: left, expected: right, negated: isNegated };
}

function getBinarySuggestion(
    node: TSESTree.BinaryExpression,
    { isPositive, source }: { isPositive: boolean; source: TSESLint.SourceCode },
): MatcherSuggestion | undefined {
    const isNegated = (node.operator === '===') !== isPositive;
    if (STRICT_EQUALITY_OPERATORS.has(node.operator))
        return getEqualitySuggestion(node.left, node.right, { isNegated, source });
    if (node.operator === 'instanceof')
        return { kind: 'instance', received: node.left, expected: node.right, negated: !isPositive };
    const kind = NUMERIC_MATCHERS.get(isPositive ? node.operator : INVERTED_OPERATORS.get(node.operator));
    const isNumber = isNumeric(node.left, source) && isNumeric(node.right, source);
    return kind !== undefined && isNumber
        ? { kind, received: node.left, expected: node.right, negated: false }
        : undefined;
}

function getIncludesSuggestion(
    node: TSESTree.Node,
    { isPositive, source }: { isPositive: boolean; source: TSESLint.SourceCode },
): MatcherSuggestion | undefined {
    const [needle, ...others] = node.type === AST_NODE_TYPES.CallExpression ? node.arguments : [];
    const callee = node.type === AST_NODE_TYPES.CallExpression ? node.callee : node;
    const isIncludes =
        callee.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(callee) === 'includes';
    if (!isIncludes || needle === undefined || others.length > 0) return undefined;
    return TEXT_RECEIVER.test(source.getText(callee.object))
        ? { kind: 'include', received: callee.object, expected: needle, negated: !isPositive }
        : undefined;
}

function getSuggestion(assertion: ComparisonAssertion, source: TSESLint.SourceCode): MatcherSuggestion | undefined {
    const { received, expected, negated } = assertion;
    const kind = getOperand(expected, source);
    if (VALUE_KINDS.has(kind)) return { kind, received, negated };
    if (received.type === AST_NODE_TYPES.MemberExpression && getOperand(received, source) === 'length')
        return { kind: 'length', received: received.object, expected, negated };
    if (!BOOLEAN_KINDS.has(kind)) return undefined;
    const isPositive = (kind === 'true') !== negated;
    return received.type === AST_NODE_TYPES.BinaryExpression
        ? getBinarySuggestion(received, { isPositive, source })
        : getIncludesSuggestion(received, { isPositive, source });
}

function getFamily(assertion: ComparisonAssertion): string | undefined {
    const parent = assertion.received.parent;
    const isPropertyAccess = parent.type === AST_NODE_TYPES.MemberExpression && parent.object === assertion.received;
    if (assertion.style === 'chai-bdd') return isPropertyAccess ? 'chai-should' : 'chai-expect';
    const isBare = assertion.node.callee.type !== AST_NODE_TYPES.MemberExpression;
    const isSkipped = assertion.style === 'chai-assert' && (isBare || assertion.comparison !== 'strict');
    return isSkipped ? undefined : MATCHER_FAMILIES.get(assertion.style);
}

function getTemplateKey(
    assertion: ComparisonAssertion,
    { kind, family, canUseSize }: { kind: string; family: string; canUseSize: boolean },
): string {
    const isJasmine = assertion.style === 'jasmine';
    const isStrictNaN = kind === 'nan' && assertion.comparison === 'strict';
    const isSkippedKind = isJasmine && (isStrictNaN || (kind === 'length' && !canUseSize));
    const name = isJasmine && kind === 'length' ? 'size' : kind;
    return isSkippedKind ? '' : `${family}.${name}`;
}

function getMessage(assertion: ComparisonAssertion, family: string, source: TSESLint.SourceCode): string {
    const { node, received } = assertion;
    const [, ...expectValues] = received.parent.type === AST_NODE_TYPES.CallExpression ? received.parent.arguments : [];
    const assertValues = node.arguments.slice(ASSERT_MESSAGE_INDEX);
    const messages = family === 'chai-assert' ? assertValues : expectValues;
    return messages.map((message) => `, ${source.getText(message)}`).join('');
}

function getFields(
    assertion: ComparisonAssertion,
    suggestion: MatcherSuggestion,
    family: string,
    source: TSESLint.SourceCode,
): Map<string, string> {
    const { callee } = assertion.node;
    const text = source.getText(suggestion.received);
    const isParenthesized = family === 'chai-should' && !BARE_RECEIVERS.has(suggestion.received.type);
    return new Map([
        ['received', isParenthesized ? `(${text})` : text],
        ['expected', suggestion.expected === undefined ? '' : source.getText(suggestion.expected)],
        ['message', getMessage(assertion, family, source)],
        ['assert', callee.type === AST_NODE_TYPES.MemberExpression ? source.getText(callee.object) : ''],
        ['method', source.getText(assertion.report)],
    ]);
}

function isLocatorVariable(node: TSESTree.Identifier, source: TSESLint.SourceCode, seen: Set<TSESTree.Node>): boolean {
    const definition = ASTUtils.findVariable(source.getScope(node), node)?.defs.at(0);
    const init = definition?.node.type === AST_NODE_TYPES.VariableDeclarator ? definition.node.init : null;
    const isUnseen = init !== null && !seen.has(init);
    return isUnseen && isLocator(init, source, seen.add(init));
}

function isLocator(node: TSESTree.Node, source: TSESLint.SourceCode, seen: Set<TSESTree.Node>): boolean {
    if (node.type === AST_NODE_TYPES.Identifier) return isLocatorVariable(node, source, seen);
    if (node.type !== AST_NODE_TYPES.CallExpression || node.callee.type !== AST_NODE_TYPES.MemberExpression)
        return false;
    const { object: receiver } = node.callee;
    const isPage = receiver.type === AST_NODE_TYPES.Identifier && receiver.name === 'page';
    const isFactory = PLAYWRIGHT_LOCATOR.test(ASTUtils.getPropertyName(node.callee) ?? '');
    return isFactory && (isPage || isLocator(receiver, source, seen));
}

function getLocatorGetter(
    assertion: ComparisonAssertion,
    source: TSESLint.SourceCode,
): TSESTree.MemberExpression | undefined {
    const getter = assertion.received.type === AST_NODE_TYPES.AwaitExpression ? assertion.received.argument : undefined;
    const callee =
        getter?.type === AST_NODE_TYPES.CallExpression && getter.arguments.length === 0 ? getter.callee : undefined;
    const isGetter = callee?.type === AST_NODE_TYPES.MemberExpression && isLocator(callee.object, source, new Set());
    return isGetter ? callee : undefined;
}

function getLocatorMatcher(
    name: string | null,
    assertion: ComparisonAssertion,
    source: TSESLint.SourceCode,
): string | undefined {
    const operand = getOperand(assertion.expected, source);
    const isFalsy = (operand === 'true') === assertion.negated;
    const state = BOOLEAN_KINDS.has(operand) ? LOCATOR_STATES.get(name)?.[Number(isFalsy)] : undefined;
    if (state !== undefined) return `${state}()`;
    const value = LOCATOR_VALUES.get(name);
    const negation = assertion.negated ? 'not.' : '';
    return value === undefined ? undefined : `${negation}${value}(${source.getText(assertion.expected)})`;
}

function getLocatorSuggestion(assertion: ComparisonAssertion, source: TSESLint.SourceCode): string | undefined {
    const getter = assertion.style === 'playwright' ? getLocatorGetter(assertion, source) : undefined;
    if (getter === undefined) return undefined;
    const matcher = getLocatorMatcher(ASTUtils.getPropertyName(getter), assertion, source);
    return matcher === undefined ? undefined : `await expect(${source.getText(getter.object)}).${matcher}`;
}

function canUseJasmineSize(context: FileContext): boolean {
    const dependencies = readPackageFacts(context).dependencies;
    const range = JASMINE_VERSION_PACKAGES.map((name) => dependencies.get(name)).find((value) => value !== undefined);
    return range !== undefined && requiresVersion(range, JASMINE_SIZE_VERSION);
}

function getMatcherText(
    assertion: ComparisonAssertion,
    suggestion: MatcherSuggestion | undefined,
    { source, canUseSize }: { source: TSESLint.SourceCode; canUseSize: boolean },
): string | undefined {
    const family = getFamily(assertion);
    if (family === undefined || suggestion === undefined) return undefined;
    const key = getTemplateKey(assertion, { kind: suggestion.kind, family, canUseSize });
    const template = MATCHER_TEMPLATES.get(key)?.[Number(suggestion.negated)];
    const fields = getFields(assertion, suggestion, family, source);
    return template?.replaceAll(TEMPLATE_FIELD, (_field, name: string) => String(fields.get(name)));
}

export const preferMatcherAssertions = createRule<[], 'matcher' | 'length' | 'replace'>({
    name: 'prefer-matcher-assertions',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        hasSuggestions: true,
        docs: {
            level: 'all',
            description:
                'Reports an equality assertion that a dedicated matcher expresses, such as a comparison with `null`, `NaN`, or a `length`, a boolean expression compared with `true`, or an awaited Playwright locator state such as `isVisible()`.',
            why: 'A dedicated matcher reads like the intent, and its failure message shows the value it received instead of `expected true, received false`.',
            fix: 'Apply the suggestion, or write the matcher that the message names.',
            example: '`expect(items.length).toBe(2)` reports `length`. Write `expect(items).toHaveLength(2)`.',
        },
        schema: [],
        messages: {
            matcher: 'Use `{{assertion}}`; a dedicated matcher reads better and reports a clearer failure.',
            length: 'Use `{{assertion}}`; a length matcher reports the length it found, and works on any value with a numeric `length`.',
            replace: 'Replace the assertion with `{{assertion}}`.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const canUseSize = canUseJasmineSize(context);
        return {
            CallExpression(node) {
                const assertion = readAssertion(node, context);
                if (assertion?.kind !== 'comparison') return;
                const locator = getLocatorSuggestion(assertion, source);
                const suggestion = getSuggestion(assertion, source);
                const text = getMatcherText(assertion, suggestion, { source, canUseSize });
                const report = { node: assertion.report, messageId: 'matcher' as const };
                if (locator !== undefined) {
                    context.report({ ...report, data: { assertion: locator } });
                    return;
                }
                if (text === undefined) return;
                const placeholders = { assertion: text };
                context.report({
                    ...report,
                    messageId: suggestion?.kind === 'length' ? 'length' : 'matcher',
                    data: placeholders,
                    suggest: [
                        {
                            messageId: 'replace',
                            data: placeholders,
                            fix: (fixer) => fixer.replaceText(assertion.node, text),
                        },
                    ],
                });
            },
        };
    },
});
