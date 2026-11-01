import { readModuleName } from './modules.ts';
import type { StateHook } from './types/rules.ts';
import { REACT_STATE_HOOK } from './config/frameworks.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function readOwnerName(node: TSESTree.Node): TSESTree.Node | null | undefined {
    switch (node.type) {
        case AST_NODE_TYPES.FunctionDeclaration:
        case AST_NODE_TYPES.VariableDeclarator: {
            return node.id;
        }
        case AST_NODE_TYPES.AssignmentExpression: {
            return node.left.type === AST_NODE_TYPES.MemberExpression ? node.left.property : node.left;
        }
        default: {
            return undefined;
        }
    }
}

/**
Check whether a function has a name that matches a pattern: its own name, or the name of the variable or member that
holds it.

@param node the function to read.
@param pattern the pattern of component or hook names.
*/
export function isNamedFunction(node: TSESTree.Node, pattern: RegExp): boolean {
    const owner = node.type === AST_NODE_TYPES.FunctionDeclaration ? node : node.parent;
    const name = owner === undefined ? undefined : readOwnerName(owner);
    return name?.type === AST_NODE_TYPES.Identifier && pattern.test(name.name);
}

function readStateDeclaration(node: TSESTree.Node, source: TSESLint.SourceCode): Omit<StateHook, 'name'> | undefined {
    if (node.type !== AST_NODE_TYPES.VariableDeclarator) return undefined;
    const { init, id } = node;
    if (init?.type !== AST_NODE_TYPES.CallExpression || id.type !== AST_NODE_TYPES.ArrayPattern) return undefined;
    const [value, setter] = id.elements;
    const isState =
        ASTUtils.isIdentifier(value) &&
        ASTUtils.isIdentifier(setter) &&
        readModuleName(init.callee, source) === REACT_STATE_HOOK;
    return isState ? { call: init, value, setter } : undefined;
}

/**
Read the `useState` call of React that declares a variable, and the state value and the setter it returns.

@param identifier a reference to the state value or to its setter.
@param source the file and its scopes.
*/
export function readStateHook(identifier: TSESTree.Identifier, source: TSESLint.SourceCode): StateHook | undefined {
    const definition = ASTUtils.findVariable(source.getScope(identifier), identifier)?.defs[0];
    const declaration = definition === undefined ? undefined : readStateDeclaration(definition.node, source);
    return declaration && definition && { ...declaration, name: definition.name };
}
