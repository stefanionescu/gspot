import type { FunctionNode } from './types/rules.ts';
import { readExpressionValue } from './expressions.ts';
import type { LocalFunction } from './types/plugin.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function readFunctionNode(node: TSESTree.Node | null): LocalFunction | undefined {
    if (node === null) return undefined;
    switch (node.type) {
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
Resolve a locally defined function or a directly called function expression.

@param node the callee to inspect.
@param source the file and its lexical variables.
*/
export function readLocalFunction(node: TSESTree.Node, source: TSESLint.SourceCode): LocalFunction | undefined {
    if (node.type !== AST_NODE_TYPES.Identifier) return readFunctionNode(node);
    const variable = ASTUtils.findVariable(source.getScope(node), node);
    if (variable?.defs.length !== 1) return undefined;
    const definition = variable.defs[0]?.node;
    if (definition === undefined) return undefined;
    return readFunctionNode(definition.type === AST_NODE_TYPES.VariableDeclarator ? definition.init : definition);
}

/**
Find the function that an expression holds or names, through the variables that hold it. A declared function without
a body does not count.

@param node the expression, such as a callback argument.
@param source the file and its lexical variables.
*/
export function findFunction(node: TSESTree.Node | undefined, source: TSESLint.SourceCode): FunctionNode | undefined {
    const value = node === undefined ? undefined : (readExpressionValue(node, source) ?? node);
    const found = value === undefined ? undefined : readLocalFunction(value, source);
    return found?.type === AST_NODE_TYPES.TSDeclareFunction ? undefined : found;
}
