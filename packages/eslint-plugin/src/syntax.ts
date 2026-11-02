import type { ImportSource } from './types/plugin.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    IMPORT_SELECTOR,
    REQUIRE_SELECTOR,
    UNWRAPPABLE_NODES,
    IMPORT_EQUALS_SELECTOR,
    MODULE_DECLARATION_NODES,
} from './config/plugin.ts';

const isModuleDeclaration = ASTUtils.isNodeOfTypes(MODULE_DECLARATION_NODES.map((type) => AST_NODE_TYPES[type]));

const isUnwrappable = ASTUtils.isNodeOfTypes(UNWRAPPABLE_NODES.map((type) => AST_NODE_TYPES[type]));

/**
Get the statement after a declaration in its block, module, or switch case.

@param node the declaration to locate.
*/
export function getNextStatement(node: TSESTree.VariableDeclaration): TSESTree.Statement | undefined {
    const { parent } = node;
    if (parent.type === AST_NODE_TYPES.SwitchCase) return parent.consequent[parent.consequent.indexOf(node) + 1];
    if (parent.type !== AST_NODE_TYPES.BlockStatement && parent.type !== AST_NODE_TYPES.Program) return undefined;
    const statements =
        parent.type === AST_NODE_TYPES.Program
            ? parent.body.filter((statement) => !isModuleDeclaration(statement))
            : parent.body;
    return statements[statements.indexOf(node) + 1];
}

/**
Discard expression wrappers that preserve the referenced value.

@param node the possibly wrapped expression.
*/
export function unwrapExpression(node: TSESTree.Node): TSESTree.Node {
    let value = node;
    while (isUnwrappable(value)) value = value.expression;
    return value;
}

function getOutermostMember(node: TSESTree.Node): TSESTree.Node {
    let outer = node;
    while (outer.parent?.type === AST_NODE_TYPES.MemberExpression && outer.parent.object === outer)
        outer = outer.parent;
    return outer;
}

function isMemberWrite(member: TSESTree.Node): boolean {
    const { parent } = member;
    if (member.type !== AST_NODE_TYPES.MemberExpression || parent === undefined) return false;
    return (
        (parent.type === AST_NODE_TYPES.AssignmentExpression && parent.left === member) ||
        parent.type === AST_NODE_TYPES.UpdateExpression ||
        (parent.type === AST_NODE_TYPES.UnaryExpression && parent.operator === 'delete')
    );
}

/**
Identify a direct alias of a value bound in this module.

@param node the expression assigned to another name
@param scope the expression's lexical scope
*/
export function isAlias(node: TSESTree.Node | null, scope: TSESLint.Scope.Scope): boolean {
    if (node === null) return false;
    let value = unwrapExpression(node);
    while (value.type === AST_NODE_TYPES.MemberExpression && !value.computed) value = unwrapExpression(value.object);
    if (value.type !== AST_NODE_TYPES.Identifier) return false;
    const variable = ASTUtils.findVariable(scope, value);
    return (
        variable !== null &&
        variable.defs.length > 0 &&
        !variable.references.some(
            (reference) =>
                (reference.isWrite() && reference.init !== true) ||
                isMemberWrite(getOutermostMember(reference.identifier)),
        )
    );
}

/**
Build the visitors that hand each module specifier of a file to one check: imports, re-exports, dynamic and type imports, import-equals declarations, and CommonJS require calls.

@param checkSource the check that receives each specifier node.
*/
export function buildSourceVisitors(checkSource: (source: TSESTree.Node) => void): TSESLint.RuleListener {
    return {
        [IMPORT_SELECTOR]: ({ source }: ImportSource) => {
            if (source !== null) checkSource(source);
        },
        [IMPORT_EQUALS_SELECTOR]: ({ expression }: TSESTree.TSExternalModuleReference) => {
            checkSource(expression);
        },
        [REQUIRE_SELECTOR]: ({ arguments: [argument] }: TSESTree.CallExpression) => {
            if (argument !== undefined) checkSource(argument);
        },
    };
}

/**
Compare two nodes or two runs of statements. Their node types and tokens must match; comments and layout do not count.

@param first a node, or the statements of one branch.
@param second the node or statements to compare with the first.
@param source the file that holds both.
*/
export function haveSameTokens(
    first: TSESTree.Node | readonly TSESTree.Node[],
    second: TSESTree.Node | readonly TSESTree.Node[],
    source: TSESLint.SourceCode,
): boolean {
    const firstNodes = [first].flat();
    const secondNodes = [second].flat();
    if (firstNodes.some((node, index) => node.type !== secondNodes[index]?.type)) return false;
    const firstTokens = firstNodes.flatMap((node) => source.getTokens(node));
    const secondTokens = secondNodes.flatMap((node) => source.getTokens(node));
    return (
        firstNodes.length === secondNodes.length &&
        firstTokens.length === secondTokens.length &&
        firstTokens.every((token, index) => token.value === secondTokens[index]?.value)
    );
}

/**
List the nodes directly below a node.

@param node the parent node.
@param visitorKeys the child keys of each node type.
*/
export function listChildren(node: TSESTree.Node, visitorKeys: TSESLint.SourceCode['visitorKeys']): TSESTree.Node[] {
    const values = (visitorKeys[node.type] ?? []).flatMap((key): unknown[] => [node[key as keyof TSESTree.Node]]);
    return values.flat().filter((child): child is TSESTree.Node => typeof child === 'object' && child !== null);
}

/**
List a node and every node below it, parents before children.

@param node the root of the walk.
@param visitorKeys the child keys of each node type.
*/
export function listDescendants(node: TSESTree.Node, visitorKeys: TSESLint.SourceCode['visitorKeys']): TSESTree.Node[] {
    const nodes: TSESTree.Node[] = [];
    const pending = [node];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
        nodes.push(next);
        pending.push(...listChildren(next, visitorKeys).toReversed());
    }
    return nodes;
}

/**
Identify a type that only forwards its name and generic parameters to another type.

@param node the alias declaration.
*/
export function isTypeAlias(node: TSESTree.TSTypeAliasDeclaration): boolean {
    const type = node.typeAnnotation;
    if (type.type !== AST_NODE_TYPES.TSTypeReference) return false;
    if (type.typeArguments === undefined) return true;
    const parameters = (node.typeParameters?.params ?? []).map((parameter) =>
        parameter.constraint === undefined && parameter.default === undefined ? parameter.name.name : null,
    );
    const passed = type.typeArguments.params.map((argument) =>
        argument.type === AST_NODE_TYPES.TSTypeReference &&
        argument.typeName.type === AST_NODE_TYPES.Identifier &&
        argument.typeArguments === undefined
            ? argument.typeName.name
            : undefined,
    );
    return passed.length === parameters.length && passed.every((name, index) => name === parameters[index]);
}
