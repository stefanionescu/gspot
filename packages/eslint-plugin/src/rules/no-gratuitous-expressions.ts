import { createRule } from '../rule.ts';
import type { TestedName, DecidedVariable } from '../types/rules.ts';
import { ASTUtils, TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

const isNegation = ASTUtils.isNodeOfTypeWithConditions(AST_NODE_TYPES.UnaryExpression, { operator: '!' });

const isConjunction = ASTUtils.isNodeOfTypeWithConditions(AST_NODE_TYPES.LogicalExpression, { operator: '&&' });

function listConjuncts(test: TSESTree.Expression): TSESTree.Expression[] {
    const conjuncts: TSESTree.Expression[] = [];
    let operand = test;
    while (isConjunction(operand)) {
        conjuncts.push(operand.right);
        operand = operand.left;
    }
    return [...conjuncts, operand];
}

function readTestedName(node: TSESTree.Expression): TestedName | undefined {
    if (ASTUtils.isIdentifier(node)) return { identifier: node, value: 'truthy' };
    if (!isNegation(node)) return undefined;
    const { argument } = node;
    return ASTUtils.isIdentifier(argument) ? { identifier: argument, value: 'falsy' } : undefined;
}

function listTestedNames(node: TSESTree.Node, statement: TSESTree.IfStatement): TestedName[] {
    const { test } = statement;
    if (Object.is(statement.consequent, node)) return listConjuncts(test).flatMap((each) => readTestedName(each) ?? []);
    const isElse = Object.is(statement.alternate, node) && ASTUtils.isIdentifier(test);
    return isElse ? [{ identifier: test, value: 'falsy' }] : [];
}

function readFunctionScope(scope: TSESLint.Scope.Scope | null): TSESLint.Scope.Scope | null {
    let enclosing = scope;
    while (enclosing !== null && enclosing.type !== TSESLint.Scope.ScopeType.function) enclosing = enclosing.upper;
    return enclosing;
}

function isWrittenAround(variable: TSESLint.Scope.Variable, scope: TSESLint.Scope.Scope): boolean {
    const functionScope = readFunctionScope(scope);
    return variable.references.some(
        (reference) =>
            reference.isWrite() &&
            (reference.identifier.range[0] > scope.block.range[0] ||
                !Object.is(readFunctionScope(reference.from), functionScope)),
    );
}

function listDecidedVariables(
    tested: readonly TestedName[],
    scope: TSESLint.Scope.Scope,
    source: TSESLint.SourceCode,
): DecidedVariable[] {
    return tested.flatMap(({ identifier, value }) => {
        const variable = ASTUtils.findVariable(source.getScope(identifier), identifier);
        return variable === null || isWrittenAround(variable, scope) ? [] : [{ variable, value }];
    });
}

function isConditionOperand(node: TSESTree.Identifier): boolean {
    const { parent } = node;
    if (parent.type === AST_NODE_TYPES.LogicalExpression)
        return parent.operator === '&&' || (parent.operator === '||' && parent.left === node);
    return parent.type === AST_NODE_TYPES.IfStatement || isNegation(parent);
}

function isJsxGuard(node: TSESTree.Identifier, source: TSESLint.SourceCode): boolean {
    const { parent } = node;
    const isGuard =
        isConjunction(parent) && parent.right === node && parent.parent.type !== AST_NODE_TYPES.LogicalExpression;
    return isGuard && source.getAncestors(node).some(({ type }) => type === AST_NODE_TYPES.JSXExpressionContainer);
}

export const noGratuitousExpressions = createRule<[], 'decided'>({
    name: 'no-gratuitous-expressions',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports a condition operand whose value an enclosing `if` statement already decided: an identifier tested truthy or falsy by the `if` whose block holds the operand, and not written in that block or another function. A literal `true` or `false` as an `if` test also counts.',
            why: 'A condition with a known result is dead logic: one branch never runs, or the test does nothing, and the code reads as if it could.',
            fix: 'Remove the test whose result is known, or move the code so that the test can change the outcome.',
            example: '`if (ready) { if (ready) start(); }` reports `decided` at the second `ready`.',
        },
        schema: [],
        messages: { decided: 'This is always {{value}} here, because an enclosing if statement tested it.' },
    },
    create(context) {
        const source = context.sourceCode;
        const decided = new Map<TSESTree.Node, DecidedVariable[]>();
        return {
            IfStatement: ({ test }) => {
                if (test.type === AST_NODE_TYPES.Literal && typeof test.value === 'boolean')
                    context.report({
                        node: test,
                        messageId: 'decided',
                        data: { value: test.value ? 'truthy' : 'falsy' },
                    });
            },
            ':statement'(node: TSESTree.Node) {
                const { parent } = node;
                if (parent?.type === AST_NODE_TYPES.IfStatement)
                    decided.set(
                        node,
                        listDecidedVariables(listTestedNames(node, parent), source.getScope(node), source),
                    );
            },
            ':statement:exit': (node: TSESTree.Node) => decided.delete(node),
            Identifier(node) {
                if (!isConditionOperand(node) || isJsxGuard(node, source)) return;
                const reference = source.getScope(node).references.find((each) => Object.is(each.identifier, node));
                const variable = reference?.resolved ?? null;
                const values = [...decided.values()].flatMap((variables) => [
                    ...new Set(
                        variables.filter((each) => Object.is(each.variable, variable)).map(({ value }) => value),
                    ),
                ]);
                for (const value of variable === null ? [] : values)
                    context.report({ node, messageId: 'decided', data: { value } });
            },
        };
    },
});
