import { createRule } from '../../rule.ts';
import { getTypes } from '../../language/checker.ts';
import type { TypeReader } from '../../types/plugin.ts';
import { haveSameTokens } from '../../language/syntax.ts';
import { NEVER_TYPE, SMALL_SWITCH_CASES } from '../../config/control-flow.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getStatementCall(statement: TSESTree.Statement): TSESTree.CallExpression | undefined {
    const isExit =
        statement.type === AST_NODE_TYPES.ReturnStatement || statement.type === AST_NODE_TYPES.ThrowStatement;
    if (!isExit && statement.type !== AST_NODE_TYPES.ExpressionStatement) return undefined;
    const value = isExit ? statement.argument : statement.expression;
    return value?.type === AST_NODE_TYPES.CallExpression ? value : undefined;
}

function isNeverCall(
    statement: TSESTree.Statement,
    discriminant: TSESTree.Node,
    source: TSESLint.SourceCode,
    types: TypeReader,
): boolean {
    const call = getStatementCall(statement);
    const { checker } = types;
    if (call === undefined || checker.typeToString(types.get(call)) !== NEVER_TYPE) return false;
    const parameters = checker.getResolvedSignature(types.map.get(call))?.getParameters() ?? [];
    return call.arguments.some((argument, index) => {
        const parameter = parameters[index];
        return (
            parameter !== undefined &&
            haveSameTokens(argument, discriminant, source) &&
            checker.typeToString(types.get(argument)) === NEVER_TYPE &&
            checker.typeToString(checker.getTypeOfSymbol(parameter)) === NEVER_TYPE
        );
    });
}

export const noSmallSwitch = createRule<[], 'small'>({
    name: 'no-small-switch',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports a switch with fewer than two cases, or with one case and a default. A default that only proves the switch exhaustive, with a `never` variable or a call that takes `never`, does not count.',
            why: 'A switch of one decision reads as a list of choices that does not exist.',
            fix: 'Replace the switch with an if statement, or with if and else.',
            example:
                '`switch (mode) { case "dark": paint(); }` reports `small`. Write `if (mode === "dark") paint();`.',
        },
        schema: [],
        messages: { small: 'This switch has fewer than three branches. Replace it with if statements.' },
    },
    create(context) {
        const types = getTypes(context);
        const source = context.sourceCode;
        return {
            SwitchStatement(node) {
                const { cases, discriminant } = node;
                const defaultCase = cases.find((clause) => clause.test === null);
                if (
                    cases.length > SMALL_SWITCH_CASES ||
                    (defaultCase === undefined && cases.length === SMALL_SWITCH_CASES)
                )
                    return;
                const isExhaustive = defaultCase?.consequent.some((statement) => {
                    if (types !== undefined && isNeverCall(statement, discriminant, source, types)) return true;
                    return (
                        statement.type === AST_NODE_TYPES.VariableDeclaration &&
                        statement.declarations.some(
                            ({ id, init }) =>
                                id.type === AST_NODE_TYPES.Identifier &&
                                id.typeAnnotation?.typeAnnotation.type === AST_NODE_TYPES.TSNeverKeyword &&
                                init !== null &&
                                haveSameTokens(init, discriminant, source),
                        )
                    );
                });
                if (isExhaustive === true) return;
                context.report({ node, messageId: 'small' });
            },
        };
    },
});
