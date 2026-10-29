import { createRule } from '../create-rule.ts';
import { FUNCTION_TYPES } from '../config/syntax.ts';
import type { FunctionNode } from '../types/syntax.ts';
import type { TrivialFunctionsOptions } from '../types/rules.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    TYPE_ONLY,
    OPTIONS_SCHEMA,
    FUNCTION_SELECTOR,
    INLINE_VALUE_PARENTS,
    EXECUTABLE_DECLARATIONS,
    TRANSPARENT_EXPRESSIONS,
    NON_EXECUTABLE_STATEMENTS,
    TRIVIAL_FUNCTION_STATEMENTS,
} from '../config/rules/no-trivial-functions.ts';

const isTransparentExpression = ASTUtils.isNodeOfTypes(TRANSPARENT_EXPRESSIONS.map((type) => AST_NODE_TYPES[type]));

function listChildNodes(
    node: TSESTree.Node,
    visitorKeys: Readonly<Record<string, readonly string[]>>,
): TSESTree.Node[] {
    return (visitorKeys[node.type] ?? []).flatMap((key) => {
        const child: unknown = node[key as keyof TSESTree.Node];
        if (Array.isArray(child)) return child.filter((nested: unknown) => nested !== null) as TSESTree.Node[];
        return child !== null && typeof child === 'object' ? [child as TSESTree.Node] : [];
    });
}

function countStatements(node: TSESTree.Node, visitorKeys: Readonly<Record<string, readonly string[]>>): number {
    if (TYPE_ONLY.has(node.type)) return 0;
    if ('declare' in node && node.declare) return 0;
    const isExpressionBody =
        FUNCTION_TYPES.has(node.type) && (node as FunctionNode).body.type !== AST_NODE_TYPES.BlockStatement;
    const isStatement = node.type.endsWith('Statement') && !NON_EXECUTABLE_STATEMENTS.has(node.type);
    const own = Number(isExpressionBody || isStatement || EXECUTABLE_DECLARATIONS.has(node.type));
    return listChildNodes(node, visitorKeys).reduce((total, child) => total + countStatements(child, visitorKeys), own);
}

function findOutermostValue(node: TSESTree.Expression): TSESTree.Expression {
    let value = node;
    while (isTransparentExpression(value.parent)) value = value.parent;
    return value;
}

function isValueSlot(value: TSESTree.Expression): boolean {
    const { parent } = value;
    switch (parent.type) {
        case AST_NODE_TYPES.Property: {
            return parent.kind === 'init' && !parent.method;
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

function isInlineValue(node: FunctionNode): boolean {
    if (node.type === AST_NODE_TYPES.FunctionDeclaration || node.id !== null) return false;
    const value = findOutermostValue(node);
    return INLINE_VALUE_PARENTS.has(value.parent.type) || isValueSlot(value);
}

export const noTrivialFunctions = createRule<TrivialFunctionsOptions, 'trivial'>({
    name: 'no-trivial-functions',
    meta: {
        defaultOptions: [{ trivialFunctionStatements: TRIVIAL_FUNCTION_STATEMENTS }],
        type: 'suggestion',
        docs: {
            example:
                'The function `function one() { return 1; }` reports `trivial`. Replace its calls with the value `1` and delete the function. A function written inline as a value has no name and is not reported: a callback argument, an array element, a return value, or the value of an object-literal key. A function that must stay, such as a method that a framework or an interface calls by name, gets a suppression comment with its reason.',
            level: 'all',
            description:
                'Reports each named function at or under the `trivialFunctionStatements` limit: function declarations, functions assigned to a name, methods, accessors, and constructors, exported or not. The count includes nested callbacks. A function written inline as a value is not reported: a callback argument, an array element, a return value, a default value, an assignment to a member, or the value of an object-literal key. Methods of object literals and classes are reported.',
            why: 'An unnecessary function adds another name and another place to read.',
            fix: 'Inline the function at its call sites and delete it. Keep a function whose identity matters, such as a listener that code adds and removes by name, and give its suppression that reason.',
        },
        schema: [OPTIONS_SCHEMA],
        messages: {
            trivial: 'This function has {{statements}}. Inline it into its callers and delete it.',
        },
    },
    create(context, [options]) {
        const limit = options.trivialFunctionStatements;
        return {
            [`${FUNCTION_SELECTOR}:exit`](node: FunctionNode) {
                const count = countStatements(node, context.sourceCode.visitorKeys);
                if (count > limit || isInlineValue(node)) return;
                context.report({
                    node,
                    messageId: 'trivial',
                    data: { statements: count === 1 ? '1 statement' : `${String(count)} statements` },
                });
            },
        };
    },
});
