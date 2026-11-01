import { createRule } from '../rule.ts';
import { readTypes } from '../checker.ts';
import { readLocalFunction } from '../functions.ts';
import type { TypeReader } from '../types/plugin.ts';
import { COMPARISON_OPERATORS } from '../config/rules.ts';
import type { CallNode, SwappedPair, ParameterNames } from '../types/rules.ts';
import { ASTUtils, TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    DIRECTIONAL_KEY,
    BOXED_TYPE_NAMES,
    COMPARATOR_ARITY,
    CRYPTO_ROUND_NAME,
    CRYPTO_STATE_SIZE,
    NAMED_ARGUMENT_MINIMUM,
} from '../config/calls.ts';

const isFunctionExpression = ASTUtils.isNodeOfTypes([
    AST_NODE_TYPES.ArrowFunctionExpression,
    AST_NODE_TYPES.FunctionExpression,
]);

function readPatternChildren(node: TSESTree.Node): TSESTree.Node[] {
    if (node.type === AST_NODE_TYPES.ObjectPattern) return node.properties;
    if (node.type === AST_NODE_TYPES.ArrayPattern) return node.elements.filter((element) => element !== null);
    if (node.type === AST_NODE_TYPES.Property) return node.shorthand ? [] : [node.value];
    if (node.type === AST_NODE_TYPES.RestElement) return [node.argument];
    if (node.type === AST_NODE_TYPES.AssignmentPattern) return [node.left];
    return node.type === AST_NODE_TYPES.TSParameterProperty ? [node.parameter] : [];
}

function listBoundNames(node: TSESTree.Node): TSESTree.Identifier[] {
    if (ASTUtils.isIdentifier(node)) return [node];
    const children = readPatternChildren(node);
    return children.flatMap((child) => listBoundNames(child));
}

function readParameterNames(
    call: CallNode,
    source: TSESLint.SourceCode,
    types: TypeReader | undefined,
): ParameterNames | undefined {
    if (types !== undefined) {
        const signature = types.checker.getResolvedSignature(types.map.get(call));
        return signature?.declaration === undefined ? undefined : signature.getParameters().map(({ name }) => name);
    }
    return readLocalFunction(call.callee, source)?.params.map((parameter) => {
        const names = listBoundNames(parameter);
        return names.length === 1 ? names[0]?.name : undefined;
    });
}

function isCryptoRotation({ callee, arguments: values }: CallNode, parameters: ParameterNames): boolean {
    const name = callee.type === AST_NODE_TYPES.MemberExpression ? callee.property : callee;
    if (!ASTUtils.isIdentifier(name) || !CRYPTO_ROUND_NAME.test(name.name)) return false;
    const state = values.slice(0, CRYPTO_STATE_SIZE).map((value) => (ASTUtils.isIdentifier(value) ? value.name : ''));
    const names = parameters.slice(0, CRYPTO_STATE_SIZE);
    if (state.length < CRYPTO_STATE_SIZE || names.length < CRYPTO_STATE_SIZE) return false;
    const shifts = Array.from({ length: CRYPTO_STATE_SIZE - 1 }, (_, index) => index + 1);
    const isNamed = !state.includes('') && !names.includes(undefined);
    return (
        isNamed &&
        shifts.some((shift) => state.every((value, index) => value === names[(index + shift) % CRYPTO_STATE_SIZE]))
    );
}

function readTypeName(node: TSESTree.Node | undefined, types: TypeReader): string {
    if (node === undefined) return '';
    const name = types.checker.typeToString(types.checker.getBaseTypeOfLiteralType(types.read(node)));
    return BOXED_TYPE_NAMES.get(name) ?? name;
}

function readSwapped(
    call: CallNode,
    names: ParameterNames,
    parameters: ParameterNames,
    index: number,
    types: TypeReader | undefined,
): string | undefined {
    const name = names[index];
    const position = name === undefined ? -1 : parameters.indexOf(name);
    const swapped = position < 0 || position === index ? undefined : names[position];
    if (swapped === undefined || swapped !== parameters[index]) return undefined;
    const values = [call.arguments[index], call.arguments[position]];
    const isSameType = types === undefined || readTypeName(values[0], types) === readTypeName(values[1], types);
    return isSameType ? swapped : undefined;
}

function readIfCondition(node: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Expression | undefined {
    const statement = source.getAncestors(node).findLast(({ type }) => type === AST_NODE_TYPES.IfStatement);
    if (statement?.type !== AST_NODE_TYPES.IfStatement) return undefined;
    const { test } = statement;
    return test.type === AST_NODE_TYPES.UnaryExpression && test.operator === '!' ? test.argument : test;
}

function listComparedSides(condition: TSESTree.Expression): TSESTree.Node[] {
    if (condition.type === AST_NODE_TYPES.BinaryExpression)
        return COMPARISON_OPERATORS.has(condition.operator) ? [condition.left, condition.right] : [];
    if (condition.type !== AST_NODE_TYPES.CallExpression || condition.callee.type !== AST_NODE_TYPES.MemberExpression)
        return [];
    const [value, ...others] = condition.arguments;
    return value === undefined || others.length > 0 ? [] : [condition.callee.object, value];
}

function readOperand(node: TSESTree.Node, source: TSESLint.SourceCode): TSESLint.Scope.Variable | string | undefined {
    let operand = node;
    while (operand.type === AST_NODE_TYPES.CallExpression || operand.type === AST_NODE_TYPES.MemberExpression)
        operand = operand.type === AST_NODE_TYPES.CallExpression ? operand.callee : operand.object;
    if (!ASTUtils.isIdentifier(operand)) return undefined;
    return ASTUtils.findVariable(source.getScope(operand), operand.name) ?? operand.name;
}

function readConstantInit(variable: TSESLint.Scope.Variable): TSESTree.Expression | undefined {
    const [definition, ...others] = variable.defs;
    if (others.length > 0 || definition?.type !== TSESLint.Scope.DefinitionType.Variable) return undefined;
    const { node: declarator, parent: declaration } = definition;
    const isConstant = declaration.kind === 'const' && declarator.id.type === AST_NODE_TYPES.Identifier;
    return isConstant ? (declarator.init ?? undefined) : undefined;
}

function isNamedMember(member: TSESTree.MemberExpression): boolean {
    const { property, computed } = member;
    if (!computed) return property.type === AST_NODE_TYPES.Identifier;
    return property.type === AST_NODE_TYPES.Literal && typeof property.value === 'string';
}

function readMemberOwner(variable: TSESLint.Scope.Variable): TSESTree.Identifier | undefined {
    const init = readConstantInit(variable);
    const writes = variable.references.filter((reference) => reference.isWrite());
    const isOnlyWrite = writes.length === 1 && Object.is(writes[0]?.writeExpr, init);
    if (init?.type !== AST_NODE_TYPES.MemberExpression || !isOnlyWrite || !isNamedMember(init)) return undefined;
    return ASTUtils.isIdentifier(init.object) ? init.object : undefined;
}

function readCopiedOwner(node: TSESTree.Node, source: TSESLint.SourceCode): TSESLint.Scope.Variable | undefined {
    const variable = ASTUtils.isIdentifier(node) ? ASTUtils.findVariable(source.getScope(node), node.name) : null;
    const owner = variable === null ? undefined : readMemberOwner(variable);
    return owner === undefined ? undefined : (ASTUtils.findVariable(source.getScope(owner), owner.name) ?? undefined);
}

function isCompared(call: CallNode, [first, second]: SwappedPair, source: TSESLint.SourceCode): boolean {
    const condition = readIfCondition(call, source);
    const sides = condition === undefined ? [] : listComparedSides(condition);
    const [left, right] = sides.map((side) => [readOperand(side, source), readCopiedOwner(side, source)]);
    if (left === undefined || right === undefined) return false;
    const scope = source.getScope(call);
    const [one, two] = [first, second].map((name) => ASTUtils.findVariable(scope, name) ?? name);
    return (left.includes(one) && right.includes(two)) || (left.includes(two) && right.includes(one));
}

function isReturnedBy(call: CallNode, body: TSESTree.Node): boolean {
    if (Object.is(body, call)) return true;
    const statements = body.type === AST_NODE_TYPES.BlockStatement ? body.body : [];
    const [statement] = statements;
    return (
        statements.length === 1 &&
        statement?.type === AST_NODE_TYPES.ReturnStatement &&
        Object.is(statement.argument, call)
    );
}

function isComparatorReversal(call: CallNode, pair: SwappedPair, source: TSESLint.SourceCode): boolean {
    const enclosing = source.getAncestors(call).findLast((ancestor) => isFunctionExpression(ancestor));
    const names = (enclosing?.params ?? []).map((parameter) =>
        ASTUtils.isIdentifier(parameter) && parameter.name.length <= 1 ? parameter.name : '',
    );
    if (enclosing === undefined || names.length !== COMPARATOR_ARITY || names.includes('')) return false;
    return isReturnedBy(call, enclosing.body) && pair.every((name) => names.includes(name));
}

function isDirectional(call: CallNode, source: TSESLint.SourceCode): boolean {
    const keys = source
        .getAncestors(call)
        .flatMap((ancestor) => (ancestor.type === AST_NODE_TYPES.Property ? [ancestor.key] : []));
    return keys.some((key) => {
        if (ASTUtils.isIdentifier(key)) return DIRECTIONAL_KEY.test(key.name);
        return key.type === AST_NODE_TYPES.Literal && typeof key.value === 'string' && DIRECTIONAL_KEY.test(key.value);
    });
}

function readMirrorCall(call: CallNode, source: TSESLint.SourceCode): TSESTree.CallExpression | undefined {
    const { parent } = call;
    if (parent.type !== AST_NODE_TYPES.ConditionalExpression || Object.is(parent.test, call)) return undefined;
    const other = Object.is(parent.consequent, call) ? parent.alternate : parent.consequent;
    if (other.type !== AST_NODE_TYPES.CallExpression || other.arguments.length !== call.arguments.length)
        return undefined;
    return source.getText(other.callee) === source.getText(call.callee) ? other : undefined;
}

function isTernarySwap(call: CallNode, pair: SwappedPair, source: TSESLint.SourceCode): boolean {
    const mirror = readMirrorCall(call, source);
    const positions = pair.map((name) =>
        call.arguments.findIndex((value) => ASTUtils.isIdentifier(value) && value.name === name),
    );
    const isMirrored = positions.every((position, index) => {
        const value = mirror?.arguments[position];
        return position >= 0 && ASTUtils.isIdentifier(value) && value.name === pair[1 - index];
    });
    const test = mirror?.parent.type === AST_NODE_TYPES.ConditionalExpression ? mirror.parent.test : undefined;
    if (!isMirrored || test?.type !== AST_NODE_TYPES.BinaryExpression || !COMPARISON_OPERATORS.has(test.operator))
        return false;
    const names = new Set([test.left, test.right].map((side) => (ASTUtils.isIdentifier(side) ? side.name : '')));
    return !names.has('') && pair.every((name) => names.has(name));
}

function isExcused(call: CallNode, pair: SwappedPair, source: TSESLint.SourceCode): boolean {
    if (isCompared(call, pair, source) || isDirectional(call, source)) return true;
    const isReversal = isComparatorReversal(call, pair, source);
    return isReversal || isTernarySwap(call, pair, source);
}

function findSwap(call: CallNode, source: TSESLint.SourceCode, types: TypeReader | undefined): SwappedPair | undefined {
    const names = call.arguments.map((value) => (ASTUtils.isIdentifier(value) ? value.name : undefined));
    if (names.filter((name) => name !== undefined).length < NAMED_ARGUMENT_MINIMUM) return undefined;
    const parameters = readParameterNames(call, source, types);
    if (parameters === undefined || isCryptoRotation(call, parameters)) return undefined;
    const pairs = names.flatMap((name, index) => {
        const swapped = readSwapped(call, names, parameters, index, types);
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
                'Reports a call that passes two variables named like two parameters of the called function, each at the position of the other parameter. With type information, the rule reads the parameters from the resolved signature and the two arguments need the same type. Without it, the rule reads local functions only. A call inside an `if` that compares the two names, a comparator that reverses its two parameters, a call under a key such as `reverse` or `rtl`, and a ternary that swaps the names on a comparison do not count.',
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
        const types = readTypes(context);
        const inspect = (call: CallNode) => {
            const pair = findSwap(call, source, types);
            const [first] = call.arguments;
            if (pair === undefined || first === undefined) return;
            const loc = { start: first.loc.start, end: (call.arguments.at(-1) ?? first).loc.end };
            context.report({ loc, messageId: 'swapped', data: { first: pair[0], second: pair[1] } });
        };
        return { CallExpression: inspect, NewExpression: inspect };
    },
});
