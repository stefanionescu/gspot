import { createRule } from '../rule.ts';
import { haveSameTokens } from '../syntax.ts';
import { EQUALITY_OPERATORS } from '../config/rules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    SIGNS,
    ASSERT_NAME,
    BIGINT_ZERO,
    EXPECT_NAME,
    BINARY_FACTOR,
    DECIMAL_FACTOR,
    ASSERT_OPERANDS,
    DECIMAL_LITERAL,
    FRACTION_MARKER,
    RANGE_OPERATORS,
    ASSERTION_MATCHERS,
    FLOAT_ARITHMETIC_OPERATORS,
    CONSTANT_ARITHMETIC_OPERATORS,
} from '../config/operators.ts';

function isInexactLiteral(text: string): boolean {
    const digits = text.replaceAll('_', '').toLowerCase();
    const match = DECIMAL_LITERAL.exec(digits);
    if (match === null || !FRACTION_MARKER.test(digits)) return false;
    const [, integer = '', fraction = '', exponent = ''] = match;
    const scale = fraction.length - Number(exponent);
    return scale > 0 && BigInt(`${integer}${fraction}`) % DECIMAL_FACTOR ** BigInt(scale) !== BIGINT_ZERO;
}

function readSigned(node: TSESTree.UnaryExpression): number | undefined {
    const sign = SIGNS.get(node.operator);
    const value = readNumber(node.argument);
    return sign === undefined || value === undefined ? undefined : sign * value;
}

function readArithmetic(node: TSESTree.BinaryExpression): number | undefined {
    const operation = CONSTANT_ARITHMETIC_OPERATORS.get(node.operator);
    const [left, right] = [readNumber(node.left), readNumber(node.right)];
    return left === undefined || right === undefined ? undefined : operation?.(left, right);
}

function readNumber(node: TSESTree.Node): number | undefined {
    switch (node.type) {
        case AST_NODE_TYPES.Literal: {
            return typeof node.value === 'number' ? node.value : undefined;
        }
        case AST_NODE_TYPES.UnaryExpression: {
            return readSigned(node);
        }
        case AST_NODE_TYPES.BinaryExpression: {
            return readArithmetic(node);
        }
        default: {
            return undefined;
        }
    }
}

function stripFactorsOfTwo(value: number): number {
    let remainder = Math.abs(value);
    while (remainder % BINARY_FACTOR === 0) remainder /= BINARY_FACTOR;
    return remainder;
}

function isFractionDivision(node: TSESTree.BinaryExpression): boolean {
    const [left, right] = [readNumber(node.left), readNumber(node.right)];
    if (left === undefined || right === undefined || right === 0) return false;
    if (!Number.isInteger(left) || Number.isInteger(left / right)) return false;
    return !Number.isSafeInteger(left) || !Number.isSafeInteger(right) || left % stripFactorsOfTwo(right) !== 0;
}

function readConstantValue(variable: TSESLint.Scope.Variable): TSESTree.Expression | undefined {
    const declarator = variable.defs[0]?.node;
    if (declarator?.type !== AST_NODE_TYPES.VariableDeclarator || declarator.parent.kind !== 'const') return undefined;
    return declarator.id.type === AST_NODE_TYPES.Identifier && declarator.init !== null ? declarator.init : undefined;
}

function isFloatingConstant(node: TSESTree.Identifier, source: TSESLint.SourceCode, seen: Set<unknown>): boolean {
    const variable = ASTUtils.findVariable(source.getScope(node), node);
    if (variable === null || seen.has(variable)) return false;
    seen.add(variable);
    const value = readConstantValue(variable);
    return value !== undefined && isFloatingPoint(value, source, seen);
}

function isFloatingArithmetic(node: TSESTree.BinaryExpression, source: TSESLint.SourceCode, seen: Set<unknown>) {
    const value = readNumber(node);
    if (value !== undefined && Number.isSafeInteger(value)) return false;
    const isOperand = [node.left, node.right].some((operand) => isFloatingPoint(operand, source, seen));
    if (node.operator === '/') return isOperand || isFractionDivision(node);
    return FLOAT_ARITHMETIC_OPERATORS.has(node.operator) && isOperand;
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

function readMatcherRoot({ callee }: TSESTree.CallExpression): TSESTree.Node | undefined {
    if (callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    let target: TSESTree.Node = callee.object;
    while (target.type === AST_NODE_TYPES.MemberExpression) target = target.object;
    return ASSERTION_MATCHERS.has(ASTUtils.getPropertyName(callee) ?? '') ? target : undefined;
}

function readAssertionOperands(node: TSESTree.CallExpression): TSESTree.Node[] {
    const target = readMatcherRoot(node);
    if (target?.type === AST_NODE_TYPES.Identifier)
        return target.name === ASSERT_NAME ? node.arguments.slice(0, ASSERT_OPERANDS) : [];
    if (target?.type !== AST_NODE_TYPES.CallExpression || target.callee.type !== AST_NODE_TYPES.Identifier) return [];
    return target.callee.name === EXPECT_NAME ? [...target.arguments.slice(0, 1), ...node.arguments.slice(0, 1)] : [];
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
                'Reports an exact comparison with a value that binary floating point cannot store exactly: `==`, `===`, `!=`, `!==`, a switch case, a pair of `<=` and `>=` that pins one value, and the equality matchers of `expect` and `assert`. A decimal literal that is a binary fraction, such as `0.5`, and arithmetic that gives a whole number pass.',
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
                if (!operands.some((operand) => isFloatingPoint(operand, source, new Set()))) return;
                context.report({ node, messageId: 'equality' });
            },
            LogicalExpression(node) {
                if (!isRangeEquality(node, source, new Set())) return;
                context.report({ node, messageId: 'equality' });
            },
            CallExpression(node) {
                const operands = readAssertionOperands(node);
                if (!operands.some((operand) => isFloatingPoint(operand, source, new Set()))) return;
                context.report({ node, messageId: 'equality' });
            },
            SwitchCase(node) {
                if (node.test === null || !isFloatingPoint(node.test, source, new Set())) return;
                context.report({ node: node.test, messageId: 'equality' });
            },
        };
    },
});
