import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import {
    EXECUTABLE_DECLARATIONS,
    EXPORT_REFERENCE_PARENTS,
    FUNCTION_SELECTOR,
    INLINE_VALUE_PARENTS,
    NON_EXECUTABLE_STATEMENTS,
    ONE_STATEMENT,
    TRANSPARENT_EXPRESSIONS,
    TRIVIAL_FUNCTION_OPTIONS_SCHEMA,
    TRIVIAL_FUNCTION_STATEMENTS,
    TYPE_DECLARATIONS,
} from '../../config/functions.ts';
import { listChildren } from '../../language/syntax.ts';
import { createRule } from '../../rule.ts';
import { type TrivialFunctionsOptions } from '../../types/functions.ts';
import { type FunctionNode } from '../../types/plugin.ts';

const isTransparentExpression = ASTUtils.isNodeOfTypes(TRANSPARENT_EXPRESSIONS.map((type) => AST_NODE_TYPES[type]));

function countStatements(node: TSESTree.Node, visitorKeys: TSESLint.SourceCode['visitorKeys']): number {
    if (TYPE_DECLARATIONS.has(node.type)) return 0;
    const isExpressionBody = ASTUtils.isFunction(node) && node.body.type !== AST_NODE_TYPES.BlockStatement;
    const isStatement = node.type.endsWith('Statement') && !NON_EXECUTABLE_STATEMENTS.has(node.type);
    const own = Number(isExpressionBody || isStatement || EXECUTABLE_DECLARATIONS.has(node.type));
    return listChildren(node, visitorKeys).reduce((total, child) => total + countStatements(child, visitorKeys), own);
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
        (('decorators' in parent && parent.decorators.length > 0) ||
            node.params.some((parameter) => parameter.type === AST_NODE_TYPES.TSParameterProperty))
    );
}

function isOverloadedMethod(node: FunctionNode): boolean {
    const { parent } = node;
    if (parent.type !== AST_NODE_TYPES.MethodDefinition) return false;
    const name = ASTUtils.getPropertyName(parent);
    return (
        name !== null &&
        parent.parent.body.some(
            (member) =>
                member.type === AST_NODE_TYPES.MethodDefinition &&
                member.value.type === AST_NODE_TYPES.TSEmptyBodyFunctionExpression &&
                ASTUtils.getPropertyName(member) === name,
        )
    );
}

function isOverloadedFunction(node: FunctionNode): boolean {
    if (node.type !== AST_NODE_TYPES.FunctionDeclaration || node.id === null) return false;
    const { id, parent } = node;
    const statement = parent.type === AST_NODE_TYPES.ExportNamedDeclaration ? parent : node;
    const siblings: readonly TSESTree.Node[] = 'body' in statement.parent ? [statement.parent.body].flat() : [];
    return siblings.some((sibling) => {
        const declaration = sibling.type === AST_NODE_TYPES.ExportNamedDeclaration ? sibling.declaration : sibling;
        return declaration?.type === AST_NODE_TYPES.TSDeclareFunction && declaration.id?.name === id.name;
    });
}

function getExportName(node: FunctionNode): string | undefined {
    const { parent } = node.type === AST_NODE_TYPES.FunctionDeclaration ? node : getOutermostValue(node);
    if (parent.type === AST_NODE_TYPES.ExportDefaultDeclaration) return 'default';
    if (parent.type === AST_NODE_TYPES.ExportNamedDeclaration) return node.id?.name;
    const isExportedConstant =
        parent.type === AST_NODE_TYPES.VariableDeclarator &&
        parent.parent.parent.type === AST_NODE_TYPES.ExportNamedDeclaration;
    return isExportedConstant && parent.id.type === AST_NODE_TYPES.Identifier ? parent.id.name : undefined;
}

function findVariable(node: FunctionNode, source: TSESLint.SourceCode): TSESLint.Scope.Variable | undefined {
    const holder = node.type === AST_NODE_TYPES.FunctionDeclaration ? undefined : getOutermostValue(node).parent;
    if (holder?.type === AST_NODE_TYPES.VariableDeclarator && holder.id.type === AST_NODE_TYPES.Identifier)
        return source.getDeclaredVariables(holder)[0];
    const name = node.id?.name;
    return name === undefined
        ? undefined
        : source.getDeclaredVariables(node).find((variable) => variable.name === name);
}

function isShared(node: FunctionNode, source: TSESLint.SourceCode): boolean {
    if (getExportName(node) !== undefined) return true;
    const references = findVariable(node, source)?.references.filter((reference) => reference.init !== true) ?? [];
    return (
        references.length > 1 ||
        references.some(({ identifier }) => EXPORT_REFERENCE_PARENTS.has(identifier.parent.type))
    );
}

function isInlineValue(node: FunctionNode): boolean {
    if (node.type === AST_NODE_TYPES.FunctionDeclaration) return false;
    const value = getOutermostValue(node);
    return (
        value.parent.type === AST_NODE_TYPES.Property ||
        (node.id === null && (INLINE_VALUE_PARENTS.has(value.parent.type) || isValueSlot(value)))
    );
}

export const noTrivialFunctions = createRule<TrivialFunctionsOptions, 'trivial'>({
    name: 'no-trivial-functions',
    meta: {
        defaultOptions: [{ trivialFunctionStatements: TRIVIAL_FUNCTION_STATEMENTS }],
        type: 'suggestion',
        docs: {
            example:
                'The function `function one() { return 1; }` with the one call `total(one())` reports `trivial`. Replace the call with `total(1)` and delete the function. A function that two places use, or that the module exports, is not reported.',
            level: 'all',
            description:
                'Reports a function of `trivialFunctionStatements` statements or fewer, nested callbacks included, that the module does not export and that at most one place in the file uses, and a class method of that size.',
            why: 'An unnecessary function adds another name and another place to read.',
            fix: 'Inline the function at its call site and delete it. Keep a function whose identity matters, such as a listener that code adds and removes by name, and give its suppression that reason.',
        },
        schema: [TRIVIAL_FUNCTION_OPTIONS_SCHEMA],
        messages: {
            trivial: 'The {{name}} has {{statements}}. Inline it into its callers and delete it.',
        },
    },
    create(context, [options]) {
        const limit = options.trivialFunctionStatements;
        const source = context.sourceCode;
        return {
            [`${FUNCTION_SELECTOR}:exit`](node: FunctionNode) {
                const count = countStatements(node, source.visitorKeys);
                const isRequired = isFrameworkMember(node) || isOverloadedMethod(node) || isOverloadedFunction(node);
                if (isRequired || count > limit || isInlineValue(node) || isShared(node, source)) return;
                context.report({
                    node,
                    messageId: 'trivial',
                    data: {
                        name: ASTUtils.getFunctionNameWithKind(node, source),
                        statements: count === 1 ? ONE_STATEMENT : `${String(count)} statements`,
                    },
                });
            },
        };
    },
});
