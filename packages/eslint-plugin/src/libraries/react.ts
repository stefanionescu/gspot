import { REACT_STATE_HOOK } from '../config/react.ts';
import { getModuleName } from '../language/modules.ts';
import type { StateHook } from '../types/utilities.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getOwnerName(node: TSESTree.Node): TSESTree.Node | null | undefined {
    let owner = node;
    while (owner.type === AST_NODE_TYPES.CallExpression) owner = owner.parent;
    return owner.type === AST_NODE_TYPES.FunctionDeclaration || owner.type === AST_NODE_TYPES.VariableDeclarator
        ? owner.id
        : undefined;
}

function getStateDeclaration(node: TSESTree.Node, source: TSESLint.SourceCode): Omit<StateHook, 'name'> | undefined {
    if (node.type !== AST_NODE_TYPES.VariableDeclarator) return undefined;
    const { init, id } = node;
    if (init?.type !== AST_NODE_TYPES.CallExpression || id.type !== AST_NODE_TYPES.ArrayPattern) return undefined;
    const [value, setter] = id.elements;
    const isState =
        ASTUtils.isIdentifier(value) &&
        ASTUtils.isIdentifier(setter) &&
        getModuleName(init.callee, source) === REACT_STATE_HOOK;
    return isState ? { call: init, value, setter } : undefined;
}

export function isNamedFunction(node: TSESTree.Node, pattern: RegExp): boolean {
    const owner = node.type === AST_NODE_TYPES.FunctionDeclaration ? node : node.parent;
    const ownName = node.type === AST_NODE_TYPES.FunctionExpression ? node.id : undefined;
    const name = ownName ?? (owner && getOwnerName(owner));
    return name?.type === AST_NODE_TYPES.Identifier && pattern.test(name.name);
}

export function getStateHook(identifier: TSESTree.Identifier, source: TSESLint.SourceCode): StateHook | undefined {
    const definition = ASTUtils.findVariable(source.getScope(identifier), identifier)?.defs[0];
    const declaration = definition && getStateDeclaration(definition.node, source);
    return declaration && { ...declaration, name: definition.name };
}
