import { getModuleName } from './modules.ts';
import type { StateHook } from './types/rules.ts';
import { REACT_STATE_HOOK } from './config/frameworks.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getOwnerName(node: TSESTree.Node): TSESTree.Node | null | undefined {
    switch (node.type) {
        case AST_NODE_TYPES.FunctionDeclaration:
        case AST_NODE_TYPES.VariableDeclarator: {
            return node.id;
        }
        case AST_NODE_TYPES.CallExpression: {
            return getOwnerName(node.parent);
        }
        default: {
            return undefined;
        }
    }
}

/**
Check whether a function has a name that matches a pattern: its own name, or the name of the variable that holds it,
directly or through a call such as `memo`.

@param node the function to read.
@param pattern the pattern of component or hook names.
*/
export function isNamedFunction(node: TSESTree.Node, pattern: RegExp): boolean {
    const owner = node.type === AST_NODE_TYPES.FunctionDeclaration ? node : node.parent;
    const ownName = node.type === AST_NODE_TYPES.FunctionExpression ? node.id : undefined;
    const name = ownName ?? (owner && getOwnerName(owner));
    return name?.type === AST_NODE_TYPES.Identifier && pattern.test(name.name);
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

/**
Get the `useState` call of React that declares a variable, and the state value and the setter it returns.

@param identifier a reference to the state value or to its setter.
@param source the file and its scopes.
*/
export function getStateHook(identifier: TSESTree.Identifier, source: TSESLint.SourceCode): StateHook | undefined {
    const definition = ASTUtils.findVariable(source.getScope(identifier), identifier)?.defs[0];
    const declaration = definition && getStateDeclaration(definition.node, source);
    return declaration && { ...declaration, name: definition.name };
}
