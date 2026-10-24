import { createRule } from '../create-rule.ts';
import { TYPE_ONLY } from '../config/syntax.ts';
import type { ImplementedFunction } from '../types/syntax.ts';
import type { TrivialFunctionsOptions } from '../types/rules.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { unwrap, countStatements, findOutermostValue } from '../syntax.ts';

import {
    OPTIONS_SCHEMA,
    FUNCTION_SELECTOR,
    PASSED_VALUE_TYPES,
    INLINE_VALUE_PARENTS,
    FUNCTION_MEMBER_PARENTS,
    TRIVIAL_FUNCTION_STATEMENTS,
} from '../config/rules/no-trivial-functions.ts';

function isInlineValue(node: ImplementedFunction): boolean {
    if (FUNCTION_MEMBER_PARENTS.has(node.parent.type)) return true;
    if (node.type === AST_NODE_TYPES.FunctionDeclaration || node.id !== null) return false;
    const value = findOutermostValue(node);
    return INLINE_VALUE_PARENTS.has(value.parent.type) || isValueSlot(value);
}

function isValueSlot(value: TSESTree.Expression): boolean {
    const parent = value.parent;
    switch (parent.type) {
        case AST_NODE_TYPES.Property: {
            return true;
        }
        case AST_NODE_TYPES.MethodDefinition:
        case AST_NODE_TYPES.PropertyDefinition: {
            return true;
        }
        case AST_NODE_TYPES.AssignmentExpression: {
            return parent.left.type === AST_NODE_TYPES.MemberExpression;
        }
        case AST_NODE_TYPES.CallExpression:
        case AST_NODE_TYPES.NewExpression: {
            return parent.arguments.includes(value);
        }
        default: {
            return false;
        }
    }
}

function unwrapPassThrough(node: TSESTree.Node | null): TSESTree.Node | null {
    let value = unwrap(node);
    while (value?.type === AST_NODE_TYPES.AwaitExpression) value = unwrap(value.argument);
    return value;
}

function isPassedValue(node: TSESTree.Node | null): boolean {
    const value = unwrapPassThrough(node);
    if (value === null || PASSED_VALUE_TYPES.has(value.type)) return true;
    return (
        value.type === AST_NODE_TYPES.MemberExpression &&
        isPassedValue(value.object) &&
        (!value.computed || isPassedValue(value.property))
    );
}

function isPassThrough(node: TSESTree.Node | null): boolean {
    const value = unwrapPassThrough(node);
    switch (value?.type) {
        case AST_NODE_TYPES.CallExpression:
        case AST_NODE_TYPES.NewExpression: {
            return isPassedValue(value.callee) && value.arguments.every((argument) => isPassedValue(argument));
        }
        case AST_NODE_TYPES.AssignmentExpression: {
            return value.operator === '=' && isPassedValue(value.left) && isPassedValue(value.right);
        }
        default: {
            return isPassedValue(value);
        }
    }
}

function isPassThroughBody(body: ImplementedFunction['body']): boolean {
    if (body.type !== AST_NODE_TYPES.BlockStatement) return isPassThrough(body);
    return body.body.every((statement) => {
        if (TYPE_ONLY.has(statement.type) || ('declare' in statement && statement.declare)) return true;
        return statement.type === AST_NODE_TYPES.ReturnStatement
            ? isPassThrough(statement.argument)
            : statement.type === AST_NODE_TYPES.ExpressionStatement && isPassThrough(statement.expression);
    });
}

export const noTrivialFunctions = createRule<TrivialFunctionsOptions, 'trivial'>({
    name: 'no-trivial-functions',
    meta: {
        defaultOptions: [{ trivialFunctionStatements: TRIVIAL_FUNCTION_STATEMENTS }],
        type: 'suggestion',
        docs: {
            example:
                'The function `function one() { return 1; }` reports `trivial`. Replace its calls with `1` and delete the function. A function that computes a value, a type predicate, and object or class members do not report. A pass-through call still reports when formatting spreads it over several lines.',
            level: 'all',
            description:
                'Reports a function at or under the `trivialFunctionStatements` limit that only passes values on to another call.',
            why: 'An unnecessary function adds another name and another place to read.',
            fix: 'Inline the function at its call sites and delete it.',
        },
        schema: [OPTIONS_SCHEMA],
        messages: {
            trivial: 'This function has {{statements}}. Inline it into its callers and delete it.',
        },
    },
    create(context, [options]) {
        const limit = options.trivialFunctionStatements;
        return {
            [`${FUNCTION_SELECTOR}:exit`](node: ImplementedFunction) {
                const count = countStatements(node, context.sourceCode.visitorKeys);
                if (
                    count > limit ||
                    isInlineValue(node) ||
                    node.returnType?.typeAnnotation.type === AST_NODE_TYPES.TSTypePredicate ||
                    !isPassThroughBody(node.body)
                )
                    return;
                context.report({
                    node,
                    messageId: 'trivial',
                    data: { statements: count === 1 ? '1 statement' : `${String(count)} statements` },
                });
            },
        };
    },
});
