import { createRule } from '../../rule.ts';
import { getTypes } from '../../language/checker.ts';
import type { TypeReader } from '../../types/plugin.ts';
import { COMPARISON_OPERATORS } from '../../config/logic.ts';
import { getLocalFunction } from '../../language/functions.ts';
import type { CallNode, SwappedPair, ParameterNames } from '../../types/rules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    DIRECTIONAL_KEY,
    BOXED_TYPE_NAMES,
    COMPARATOR_ARITY,
    CRYPTO_ROUND_NAME,
    CRYPTO_STATE_SIZE,
    NAMED_ARGUMENT_MINIMUM,
} from '../../config/functions.ts';

function getParameterNames(
    call: CallNode,
    source: TSESLint.SourceCode,
    types: TypeReader | undefined,
): ParameterNames | undefined {
    if (types !== undefined)
        return types.checker
            .getResolvedSignature(types.map.get(call))
            ?.getParameters()
            .map(({ name }) => name);
    return getLocalFunction(call.callee, source)?.params.map((parameter) => {
        const target = parameter.type === AST_NODE_TYPES.AssignmentPattern ? parameter.left : parameter;
        return ASTUtils.isIdentifier(target) ? target.name : undefined;
    });
}

function isCryptoRotation({ callee, arguments: values }: CallNode, parameters: ParameterNames): boolean {
    const name = callee.type === AST_NODE_TYPES.MemberExpression ? callee.property : callee;
    if (!ASTUtils.isIdentifier(name) || !CRYPTO_ROUND_NAME.test(name.name)) return false;
    const state = values.slice(0, CRYPTO_STATE_SIZE).map((value) => (ASTUtils.isIdentifier(value) ? value.name : ''));
    const names = parameters.slice(0, CRYPTO_STATE_SIZE);
    const shifts = Array.from({ length: CRYPTO_STATE_SIZE - 1 }, (_, index) => index + 1);
    return shifts.some((shift) => state.every((value, index) => value === names[(index + shift) % CRYPTO_STATE_SIZE]));
}

function getSwappedName(
    call: CallNode,
    names: ParameterNames,
    parameters: ParameterNames,
    index: number,
    types: TypeReader | undefined,
): string | undefined {
    const position = parameters.indexOf(names[index]);
    const swapped = position === -1 || position === index ? undefined : names[position];
    if (swapped === undefined || swapped !== parameters[index]) return undefined;
    if (types === undefined) return swapped;
    const values = call.arguments.filter((_, at) => at === index || at === position);
    const typeNames = new Set(
        values.map((value) => {
            const name = types.checker.typeToString(types.checker.getBaseTypeOfLiteralType(types.get(value)));
            return BOXED_TYPE_NAMES.get(name) ?? name;
        }),
    );
    return typeNames.size === 1 ? swapped : undefined;
}

function getIfCondition(node: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Expression | undefined {
    const statement = source
        .getAncestors(node)
        .findLast(({ type }) => type === AST_NODE_TYPES.IfStatement || type === AST_NODE_TYPES.ConditionalExpression);
    if (statement?.type !== AST_NODE_TYPES.IfStatement && statement?.type !== AST_NODE_TYPES.ConditionalExpression)
        return undefined;
    const { test } = statement;
    return test.type === AST_NODE_TYPES.UnaryExpression && test.operator === '!' ? test.argument : test;
}

function listComparedSides(condition: TSESTree.Expression): TSESTree.Node[] {
    if (condition.type === AST_NODE_TYPES.BinaryExpression)
        return COMPARISON_OPERATORS.has(condition.operator) ? [condition.left, condition.right] : [];
    return condition.type === AST_NODE_TYPES.CallExpression &&
        condition.callee.type === AST_NODE_TYPES.MemberExpression &&
        condition.arguments.length === 1
        ? [condition.callee.object, ...condition.arguments]
        : [];
}

function getOperand(node: TSESTree.Node, source: TSESLint.SourceCode): TSESLint.Scope.Variable | string | undefined {
    let operand = node;
    while (operand.type === AST_NODE_TYPES.CallExpression || operand.type === AST_NODE_TYPES.MemberExpression)
        operand = operand.type === AST_NODE_TYPES.CallExpression ? operand.callee : operand.object;
    if (!ASTUtils.isIdentifier(operand)) return undefined;
    return ASTUtils.findVariable(source.getScope(operand), operand.name) ?? operand.name;
}

function isCompared(call: CallNode, [first, second]: SwappedPair, source: TSESLint.SourceCode): boolean {
    const condition = getIfCondition(call, source);
    const sides = condition === undefined ? [] : listComparedSides(condition);
    const [left, right] = sides.map((side) => getOperand(side, source));
    if (left === undefined || right === undefined) return false;
    const scope = source.getScope(call);
    const [one, two] = [first, second].map((name) => ASTUtils.findVariable(scope, name) ?? name);
    return (left === one && right === two) || (left === two && right === one);
}

function isComparatorReversal(call: CallNode, pair: SwappedPair, source: TSESLint.SourceCode): boolean {
    const enclosing = source.getAncestors(call).findLast((ancestor) => ASTUtils.isFunction(ancestor));
    const names = (enclosing?.params ?? []).map((parameter) =>
        ASTUtils.isIdentifier(parameter) && parameter.name.length <= 1 ? parameter.name : '',
    );
    if (enclosing === undefined || names.length !== COMPARATOR_ARITY || names.includes('')) return false;
    const isReturned = call.parent.type === AST_NODE_TYPES.ReturnStatement || Object.is(enclosing.body, call);
    return isReturned && pair.every((name) => names.includes(name));
}

function isExcused(call: CallNode, pair: SwappedPair, source: TSESLint.SourceCode): boolean {
    const isDirectional = source
        .getAncestors(call)
        .some(
            (ancestor) =>
                ancestor.type === AST_NODE_TYPES.Property &&
                DIRECTIONAL_KEY.test(String(ASTUtils.getPropertyName(ancestor))),
        );
    return isCompared(call, pair, source) || isDirectional || isComparatorReversal(call, pair, source);
}

function findSwap(call: CallNode, source: TSESLint.SourceCode, types: TypeReader | undefined): SwappedPair | undefined {
    const names = call.arguments.map((value) => (ASTUtils.isIdentifier(value) ? value.name : undefined));
    if (names.filter((name) => name !== undefined).length < NAMED_ARGUMENT_MINIMUM) return undefined;
    const parameters = getParameterNames(call, source, types);
    if (parameters === undefined || isCryptoRotation(call, parameters)) return undefined;
    const pairs = names.flatMap((name, index) => {
        const swapped = getSwappedName(call, names, parameters, index, types);
        return name === undefined || swapped === undefined ? [] : [[name, swapped] as const];
    });
    return pairs.find((pair) => !isExcused(call, pair, source));
}

export const noSwappedArguments = createRule<[], 'swapped'>({
    name: 'no-swapped-arguments',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a call that passes two variables named like two parameters of the called function, each at the position of the other parameter. With type information, the rule reads the parameters from the resolved signature and the two arguments need the same type. Without it, the rule reads local functions only. A call inside an `if` or a ternary that compares the two names, a comparator that reverses its two parameters, and a call under a key such as `reverse` or `rtl` do not count.',
            why: 'Arguments with the names of the parameters in another order usually mean that the caller swapped them by mistake.',
            fix: 'Pass the arguments in the order of the parameters, or rename the variables when the swap is deliberate.',
            example: '`function divide(dividend, divisor) {} divide(divisor, dividend);` reports `swapped`.',
        },
        schema: [],
        messages: {
            swapped: 'Arguments {{first}} and {{second}} have the names of the parameters in the other order.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const types = getTypes(context);
        const inspect = (call: CallNode) => {
            const pair = findSwap(call, source, types);
            const [first] = call.arguments;
            const last = call.arguments.at(-1);
            if (!pair || first === undefined || last === undefined) return;
            const loc = { start: first.loc.start, end: last.loc.end };
            context.report({ loc, messageId: 'swapped', data: { first: pair[0], second: pair[1] } });
        };
        return { CallExpression: inspect, NewExpression: inspect };
    },
});
