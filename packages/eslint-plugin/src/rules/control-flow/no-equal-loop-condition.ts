import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { EQUALITY_OPERATORS, INCREMENT_OPERATORS, INEQUALITY_OPERATORS, STEP_OPERATORS } from '../../config/logic.ts';
import { createRule } from '../../rule.ts';

function listCounters(update: TSESTree.Expression | null): TSESTree.Node[] {
    if (update?.type === AST_NODE_TYPES.SequenceExpression)
        return update.expressions.flatMap((expression) => listCounters(expression));
    if (update?.type === AST_NODE_TYPES.UpdateExpression) return [update.argument];
    return update?.type === AST_NODE_TYPES.AssignmentExpression && STEP_OPERATORS.has(update.operator)
        ? [update.left]
        : [];
}

function getStep(update: TSESTree.Expression): { counter: TSESTree.Node; direction: number } | undefined {
    if (update.type === AST_NODE_TYPES.UpdateExpression)
        return { counter: update.argument, direction: update.operator === '++' ? 1 : -1 };
    if (
        update.type !== AST_NODE_TYPES.AssignmentExpression ||
        !STEP_OPERATORS.has(update.operator) ||
        update.right.type !== AST_NODE_TYPES.Literal ||
        update.right.value !== 1
    )
        return undefined;
    return { counter: update.left, direction: INCREMENT_OPERATORS.has(update.operator) ? 1 : -1 };
}

function getLiteralNumber(node: TSESTree.Node | null | undefined): number | undefined {
    if (node?.type !== AST_NODE_TYPES.Literal || typeof node.value !== 'number') return undefined;
    return node.value;
}

function getStart(init: TSESTree.ForStatement['init']): number | undefined {
    if (init?.type === AST_NODE_TYPES.AssignmentExpression) return getLiteralNumber(init.right);
    return init?.type === AST_NODE_TYPES.VariableDeclaration && init.declarations.length === 1
        ? getLiteralNumber(init.declarations[0]?.init)
        : undefined;
}

function isReadInBody(node: TSESTree.ForStatement, counter: TSESTree.Identifier, source: TSESLint.SourceCode) {
    const variable = ASTUtils.findVariable(source.getScope(node), counter);
    const [bodyStart, bodyEnd] = node.body.range;
    return (variable?.references ?? []).some(
        ({ identifier }) => identifier.range[0] > bodyStart && identifier.range[1] < bodyEnd,
    );
}

function isSimpleCount(node: TSESTree.ForStatement, test: TSESTree.BinaryExpression, source: TSESLint.SourceCode) {
    const step = node.update && getStep(node.update);
    if (step?.counter.type !== AST_NODE_TYPES.Identifier || !INEQUALITY_OPERATORS.has(test.operator)) return false;
    const [start, end] = [getStart(node.init), getLiteralNumber(test.right)];
    return (
        start !== undefined &&
        end !== undefined &&
        !isReadInBody(node, step.counter, source) &&
        step.direction === Math.sign(end - start)
    );
}

function getCounterTest(node: TSESTree.ForStatement): TSESTree.BinaryExpression | undefined {
    const { test } = node;
    if (test?.type !== AST_NODE_TYPES.BinaryExpression || !EQUALITY_OPERATORS.has(test.operator)) return undefined;
    const { left } = test;
    const isCounter =
        left.type === AST_NODE_TYPES.Identifier &&
        listCounters(node.update).some((counter) => ASTUtils.isIdentifier(counter) && counter.name === left.name);
    return isCounter ? test : undefined;
}

export const noEqualLoopCondition = createRule<[], 'equality'>({
    name: 'no-equal-loop-condition',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a `for` loop that steps its counter with `++`, `--`, `+=`, or `-=` and stops on an equality test of that counter.',
            why: 'A counter that steps past its end value never equals it, so the loop does not stop.',
            fix: 'Compare the counter with `<`, `<=`, `>`, or `>=`.',
            example:
                '`for (let index = 0; index !== limit; index += 2)` reports `equality`. Write `index < limit` instead.',
        },
        schema: [],
        messages: {
            equality: 'Replace {{operator}} with <, <=, >, or >= so the loop stops when the counter passes its end.',
        },
    },
    create(context) {
        return {
            ForStatement(node) {
                const test = getCounterTest(node);
                if (test === undefined || isSimpleCount(node, test, context.sourceCode)) return;
                context.report({ node: test, messageId: 'equality', data: { operator: test.operator } });
            },
        };
    },
});
