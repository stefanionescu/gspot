import { listBodyNodes } from './syntax.ts';
import { getExpressionValue } from './expressions.ts';
import type { FunctionNode, LocalFunction } from '../types/plugin.ts';
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

export function findFunction(node: TSESTree.Node | undefined, source: TSESLint.SourceCode): FunctionNode | undefined {
    const value = getExpressionValue(node, source) ?? node;
    const found = value && getLocalFunction(value, source);
    return found?.type === AST_NODE_TYPES.TSDeclareFunction ? undefined : found;
}

export function findEnclosingFunction(node: TSESTree.Node, source: TSESLint.SourceCode): FunctionNode | undefined {
    return source.getAncestors(node).findLast((ancestor) => ASTUtils.isFunction(ancestor));
}

/**
List the nodes between the enclosing function and a node, from the outermost one to the node itself.
*/
export function listFunctionAncestors(node: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Node[] {
    const ancestors = source.getAncestors(node);
    return [...ancestors.slice(ancestors.findLastIndex((ancestor) => ASTUtils.isFunction(ancestor)) + 1), node];
}

/**
List the values that a function returns: the body of an arrow function without a block, or the argument of each
`return` statement outside a nested function.
*/
export function listReturnedValues(fn: FunctionNode, source: TSESLint.SourceCode): TSESTree.Expression[] {
    if (fn.body.type !== AST_NODE_TYPES.BlockStatement) return [fn.body];
    return listBodyNodes(fn.body, source).flatMap((node) =>
        node.type === AST_NODE_TYPES.ReturnStatement && node.argument !== null ? [node.argument] : [],
    );
}
