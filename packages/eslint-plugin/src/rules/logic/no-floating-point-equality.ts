import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import {
    BIGINT_ZERO,
    BINARY_FACTOR,
    DECIMAL_FACTOR,
    DECIMAL_LITERAL,
    EQUALITY_OPERATORS,
    FLOAT_ARITHMETIC_OPERATORS,
    FRACTION_MARKER,
    RANGE_OPERATORS,
    SIGNS,
} from '../../config/logic.ts';
import { haveSameTokens } from '../../language/syntax.ts';
import { createRule } from '../../rule.ts';

function isInexactLiteral(text: string): boolean {
    const digits = text.replaceAll('_', '').toLowerCase();
    const match = DECIMAL_LITERAL.exec(digits);
    if (match === null || !FRACTION_MARKER.test(digits)) return false;
    const [, integer = '', fraction = '', exponent = ''] = match;
    const scale = fraction.length - Number(exponent);
    return scale > 0 && BigInt(`${integer}${fraction}`) % DECIMAL_FACTOR ** BigInt(scale) !== BIGINT_ZERO;
}

function getNumber(node: TSESTree.Node): number | undefined {
    const evaluated = ASTUtils.getStaticValue(node);
    if (typeof evaluated?.value !== 'number') return undefined;
    return evaluated.value;
}

function stripFactorsOfTwo(value: number): number {
    let remainder = Math.abs(value);
    while (remainder % BINARY_FACTOR === 0) remainder /= BINARY_FACTOR;
    return remainder;
}

function isFractionDivision(node: TSESTree.BinaryExpression): boolean {
    const [left, right] = [getNumber(node.left), getNumber(node.right)];
    if (left === undefined || right === undefined || right === 0) return false;
    if (Number.isSafeInteger(left) && Number.isSafeInteger(right)) return left % stripFactorsOfTwo(right) !== 0;
    // Every finite number past the safe integers has no fractional part.
    const [isLeftInteger, isQuotientInteger] = [left, left / right].map(
        (value) => Number.isSafeInteger(value) || (Number.isFinite(value) && Math.abs(value) > Number.MAX_SAFE_INTEGER),
    );
    return isLeftInteger === true && isQuotientInteger === false;
}

function isFloatingConstant(node: TSESTree.Identifier, source: TSESLint.SourceCode, seen: Set<unknown>): boolean {
    const variable = ASTUtils.findVariable(source.getScope(node), node);
    if (variable === null || seen.has(variable)) return false;
    seen.add(variable);
    const declarator = variable.defs[0]?.node;
    const isConstant = declarator?.type === AST_NODE_TYPES.VariableDeclarator && declarator.parent.kind === 'const';
    return isConstant && declarator.init !== null && isFloatingPoint(declarator.init, source, seen);
}

function isFloatingArithmetic(node: TSESTree.BinaryExpression, source: TSESLint.SourceCode, seen: Set<unknown>) {
    const value = getNumber(node);
    if (value !== undefined && Number.isSafeInteger(value)) return false;
    const isOperand = [node.left, node.right].some((operand) => isFloatingPoint(operand, source, seen));
    return node.operator === '/'
        ? isOperand || isFractionDivision(node)
        : FLOAT_ARITHMETIC_OPERATORS.has(node.operator) && isOperand;
}

function isFloatingPoint(node: TSESTree.Node, source: TSESLint.SourceCode, seen: Set<unknown>): boolean {
    switch (node.type) {
        case AST_NODE_TYPES.Literal: {
            return typeof node.value === 'number' && isInexactLiteral(node.raw);
        }
        case AST_NODE_TYPES.Identifier: {
            return isFloatingConstant(node, source, seen);
        }
        case AST_NODE_TYPES.UnaryExpression: {
            return SIGNS.has(node.operator) && isFloatingPoint(node.argument, source, seen);
        }
        case AST_NODE_TYPES.BinaryExpression: {
            return isFloatingArithmetic(node, source, seen);
        }
        default: {
            return false;
        }
    }
}

function isRangeEquality(node: TSESTree.LogicalExpression, source: TSESLint.SourceCode, seen: Set<unknown>): boolean {
    const operators = RANGE_OPERATORS.get(node.operator) ?? [];
    const [left = [], right = []] = [node.left, node.right].map((side) =>
        side.type === AST_NODE_TYPES.BinaryExpression && operators.includes(side.operator)
            ? [
                  { value: side.left, bound: side.right, above: side.operator.startsWith('>') },
                  { value: side.right, bound: side.left, above: side.operator.startsWith('<') },
              ]
            : [],
    );
    return left.some((first) =>
        right.some(
            (second) =>
                first.above !== second.above &&
                haveSameTokens(first.value, second.value, source) &&
                haveSameTokens(first.bound, second.bound, source) &&
                (isFloatingPoint(first.value, source, seen) || isFloatingPoint(first.bound, source, seen)),
        ),
    );
}

export const noFloatingPointEquality = createRule<[], 'equality'>({
    name: 'no-floating-point-equality',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports an exact comparison with a value that binary floating point cannot store exactly, such as `total === 0.3`, a `switch` case, or a pair of `<=` and `>=` that pins one value.',
            why: 'A decimal such as 0.1 has no exact binary form, so `0.1 + 0.2 === 0.3` is false.',
            fix: 'Compare the difference with a tolerance, such as `Math.abs(total - 0.3) < Number.EPSILON`, or compare whole numbers of the smallest unit.',
            example: '`if (total === 0.3)` reports `equality`. Write `if (Math.abs(total - 0.3) < 1e-9)`.',
        },
        schema: [],
        messages: { equality: 'Do not compare floating-point values exactly. Compare them within a tolerance.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            BinaryExpression(node) {
                const operands = EQUALITY_OPERATORS.has(node.operator) ? [node.left, node.right] : [];
                if (operands.every((operand) => !isFloatingPoint(operand, source, new Set()))) return;
                context.report({ node, messageId: 'equality' });
            },
            LogicalExpression(node) {
                if (!isRangeEquality(node, source, new Set())) return;
                context.report({ node, messageId: 'equality' });
            },
            SwitchCase(node) {
                if (node.test === null || !isFloatingPoint(node.test, source, new Set())) return;
                context.report({ node: node.test, messageId: 'equality' });
            },
        };
    },
});
