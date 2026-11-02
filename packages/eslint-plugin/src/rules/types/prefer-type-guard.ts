import { createRule } from '../../rule.ts';
import { BOOLEAN_NAME } from '../../config/types.ts';
import { UNDEFINED_NAME } from '../../config/plugin.ts';
import { INEQUALITY_OPERATORS } from '../../config/logic.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getComparedValue(node: TSESTree.BinaryExpression): TSESTree.Node | undefined {
    if (!INEQUALITY_OPERATORS.has(node.operator)) return undefined;
    const sides = [node.left, node.right];
    const index = sides.findIndex((side) => ASTUtils.isIdentifier(side) && side.name === UNDEFINED_NAME);
    return index === -1 ? undefined : sides[1 - index];
}

function getNegatedValue(node: TSESTree.UnaryExpression): TSESTree.Expression | undefined {
    const { argument, operator } = node;
    const isDouble = operator === '!' && argument.type === AST_NODE_TYPES.UnaryExpression;
    return isDouble && argument.operator === '!' ? argument.argument : undefined;
}

function getTestedValue(node: TSESTree.Expression | null): TSESTree.Node | undefined {
    switch (node?.type) {
        case AST_NODE_TYPES.BinaryExpression: {
            return getComparedValue(node);
        }
        case AST_NODE_TYPES.UnaryExpression: {
            return getNegatedValue(node);
        }
        case AST_NODE_TYPES.CallExpression: {
            const isBoolean = ASTUtils.isIdentifier(node.callee) && node.callee.name === BOOLEAN_NAME;
            return isBoolean && node.arguments.length === 1 ? node.arguments[0] : undefined;
        }
        default: {
            return undefined;
        }
    }
}

function getSoleReturn(statements: readonly TSESTree.Statement[]): TSESTree.Expression | null {
    const [statement, ...rest] = statements;
    if (statement?.type !== AST_NODE_TYPES.ReturnStatement || rest.length > 0) return null;
    return statement.argument;
}

function getCast(node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression) {
    const tested = getTestedValue(getSoleReturn(node.body.body));
    if (tested?.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    const { object } = tested;
    const isCast = object.type === AST_NODE_TYPES.TSAsExpression || object.type === AST_NODE_TYPES.TSTypeAssertion;
    return isCast && object.typeAnnotation.type !== AST_NODE_TYPES.TSAnyKeyword ? object : undefined;
}

export const preferTypeGuard = createRule<[], 'guard'>({
    name: 'prefer-type-guard',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports a function or method of one parameter, or of none for `this`, whose only statement returns a check that a member of a cast value exists: `(value as Fish).swim !== undefined`, `Boolean((value as Fish).swim)`, or `!!(value as Fish).swim`. A function with a type predicate passes.',
            why: 'The check narrows nothing for the caller, who has to cast the value again after a true result.',
            fix: 'Declare the result as a type predicate, such as `function isFish(value: Pet): value is Fish`.',
            example:
                '`function isFish(pet: Pet) { return (pet as Fish).swim !== undefined; }` reports `guard`. Add `: pet is Fish`.',
        },
        schema: [],
        messages: { guard: 'Declare the result as the type predicate `{{value}} is {{type}}`.' },
    },
    create(context) {
        const inspect = (node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression) => {
            if (node.returnType?.typeAnnotation.type === AST_NODE_TYPES.TSTypePredicate) return;
            const cast = getCast(node);
            const isSubject = node.params.length === 1 || cast?.expression.type === AST_NODE_TYPES.ThisExpression;
            if (cast === undefined || !isSubject || node.params.length > 1) return;
            const value = context.sourceCode.getText(cast.expression);
            context.report({
                node,
                messageId: 'guard',
                data: { value, type: context.sourceCode.getText(cast.typeAnnotation) },
            });
        };
        return {
            FunctionDeclaration: inspect,
            "MethodDefinition[kind='method'] FunctionExpression": inspect,
        };
    },
});
