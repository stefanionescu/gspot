import { createRule } from '../rule-creator.ts';
import { FUNCTION_NODES } from '../config/plugin.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { type FunctionNode, type TrivialFunctionsOptions } from '../types/rules.ts';

import {
    ONE_STATEMENT,
    TYPE_DECLARATIONS,
    FUNCTION_SELECTOR,
    INLINE_VALUE_PARENTS,
    EXECUTABLE_DECLARATIONS,
    TRANSPARENT_EXPRESSIONS,
    NON_EXECUTABLE_STATEMENTS,
    TRIVIAL_FUNCTION_STATEMENTS,
    TRIVIAL_FUNCTION_OPTIONS_SCHEMA,
} from '../config/rules.ts';

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
    if (TYPE_DECLARATIONS.has(node.type)) return 0;
    if ('declare' in node && node.declare) return 0;
    const isExpressionBody =
        FUNCTION_NODES.has(node.type) && (node as FunctionNode).body.type !== AST_NODE_TYPES.BlockStatement;
    const isStatement = node.type.endsWith('Statement') && !NON_EXECUTABLE_STATEMENTS.has(node.type);
    const own = Number(isExpressionBody || isStatement || EXECUTABLE_DECLARATIONS.has(node.type));
    return listChildNodes(node, visitorKeys).reduce((total, child) => total + countStatements(child, visitorKeys), own);
}

function getOutermostValue(node: TSESTree.Expression): TSESTree.Expression {
    let value = node;
    while (isTransparentExpression(value.parent)) value = value.parent;
    return value;
}

function isValueSlot(value: TSESTree.Expression): boolean {
    const { parent } = value;
    switch (parent.type) {
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

function isFrameworkMember(node: FunctionNode): boolean {
    const { parent } = node;
    return (
        parent.type === AST_NODE_TYPES.MethodDefinition &&
        (parent.decorators.length > 0 ||
            node.params.some((parameter) => parameter.type === AST_NODE_TYPES.TSParameterProperty))
    );
}

function isInlineValue(node: FunctionNode): boolean {
    if (node.type === AST_NODE_TYPES.FunctionDeclaration) return false;
    const value = getOutermostValue(node);
    if (value.parent.type === AST_NODE_TYPES.Property) return true;
    return node.id === null && (INLINE_VALUE_PARENTS.has(value.parent.type) || isValueSlot(value));
}

export const noTrivialFunctions = createRule<TrivialFunctionsOptions, 'trivial'>({
    name: 'no-trivial-functions',
    meta: {
        defaultOptions: [{ trivialFunctionStatements: TRIVIAL_FUNCTION_STATEMENTS }],
        type: 'suggestion',
        docs: {
            example:
                'The function `function one() { return 1; }` reports `trivial`. Replace its calls with the value `1` and delete the function. A function written inline as a value has no name and is not reported: a callback argument, an array element, a return value, or a member of an object literal. A function that must stay, such as a method that a framework or an interface calls by name, gets a suppression comment with its reason.',
            level: 'all',
            description:
                'Reports each named function at or under the `trivialFunctionStatements` limit: function declarations, functions assigned to a name, and the methods, accessors, and constructors of classes, exported or not. The count includes nested callbacks. A function written inline as a value is not reported: a callback argument, an array element, a return value, a default value, or an assignment to a member. No member of an object literal is reported: methods, accessors, and function values alike. A decorated method and a constructor with parameter properties are not reported, because a framework calls them. Other class methods are reported.',
            why: 'An unnecessary function adds another name and another place to read.',
            fix: 'Inline the function at its call sites and delete it. Keep a function whose identity matters, such as a listener that code adds and removes by name, and give its suppression that reason.',
        },
        schema: [TRIVIAL_FUNCTION_OPTIONS_SCHEMA],
        messages: {
            trivial: 'This function has {{statements}}. Inline it into its callers and delete it.',
        },
    },
    create(context, [options]) {
        const limit = options.trivialFunctionStatements;
        return {
            [`${FUNCTION_SELECTOR}:exit`](node: FunctionNode) {
                const count = countStatements(node, context.sourceCode.visitorKeys);
                if (count > limit || isInlineValue(node) || isFrameworkMember(node)) return;
                context.report({
                    node,
                    messageId: 'trivial',
                    data: { statements: count === 1 ? ONE_STATEMENT : `${String(count)} statements` },
                });
            },
        };
    },
});
