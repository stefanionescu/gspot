import type { FunctionNode } from '../types/rules.ts';
import { getExpressionValue } from './expressions.ts';
import type { LocalFunction } from '../types/plugin.ts';
import { ASTUtils, TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getFunctionNode(node: TSESTree.Node | null): LocalFunction | undefined {
    switch (node?.type) {
        case AST_NODE_TYPES.FunctionDeclaration:
        case AST_NODE_TYPES.FunctionExpression:
        case AST_NODE_TYPES.ArrowFunctionExpression:
        case AST_NODE_TYPES.TSDeclareFunction: {
            return node;
        }
        default: {
            return undefined;
        }
    }
}

/**
Resolve a locally defined function or a directly called function expression. A parameter resolves to nothing: its
definition names the function that declares it, not the function that it holds.

@param node the callee to inspect.
@param source the file and its lexical variables.
*/
export function getLocalFunction(node: TSESTree.Node, source: TSESLint.SourceCode): LocalFunction | undefined {
    if (node.type !== AST_NODE_TYPES.Identifier) return getFunctionNode(node);
    const variable = ASTUtils.findVariable(source.getScope(node), node);
    if (variable?.defs.length !== 1) return undefined;
    const [definition] = variable.defs;
    if (definition === undefined || definition.type === TSESLint.Scope.DefinitionType.Parameter) return undefined;
    const declaration = definition.node;
    return getFunctionNode(declaration.type === AST_NODE_TYPES.VariableDeclarator ? declaration.init : declaration);
}

/**
Find the function that an expression holds or names, through the variables that hold it. A declared function without
a body does not count.

@param node the expression, such as a callback argument.
@param source the file and its lexical variables.
*/
export function findFunction(node: TSESTree.Node | undefined, source: TSESLint.SourceCode): FunctionNode | undefined {
    const value = getExpressionValue(node, source) ?? node;
    const found = value && getLocalFunction(value, source);
    return found?.type === AST_NODE_TYPES.TSDeclareFunction ? undefined : found;
}
