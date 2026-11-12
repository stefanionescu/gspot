import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import {
    FUNCTION_NODES,
    IMPORT_EQUALS_SELECTOR,
    IMPORT_SELECTOR,
    MODULE_DECLARATION_NODES,
    REQUIRE_SELECTOR,
    UNWRAPPABLE_NODES,
} from '../config/plugin.ts';
import type { ImportSource } from '../types/plugin.ts';

const isModuleDeclaration = ASTUtils.isNodeOfTypes(MODULE_DECLARATION_NODES.map((type) => AST_NODE_TYPES[type]));

const isUnwrappable = ASTUtils.isNodeOfTypes(UNWRAPPABLE_NODES.map((type) => AST_NODE_TYPES[type]));

function getOutermostMember(node: TSESTree.Node): TSESTree.Node {
    let outer = node;
    while (outer.parent?.type === AST_NODE_TYPES.MemberExpression && outer.parent.object === outer)
        outer = outer.parent;
    return outer;
}

function isMemberWrite(member: TSESTree.Node): boolean {
    const { parent } = member;
    if (parent === undefined || member.type !== AST_NODE_TYPES.MemberExpression) return false;
    return (
        (parent.type === AST_NODE_TYPES.AssignmentExpression && parent.left === member) ||
        parent.type === AST_NODE_TYPES.UpdateExpression ||
        (parent.type === AST_NODE_TYPES.UnaryExpression && parent.operator === 'delete')
    );
}

export function listSiblingStatements(statement: TSESTree.Node): readonly TSESTree.Node[] {
    const { parent } = statement;
    if (parent?.type === AST_NODE_TYPES.Program || parent?.type === AST_NODE_TYPES.BlockStatement) return parent.body;
    return parent?.type === AST_NODE_TYPES.SwitchCase ? parent.consequent : [];
}

export function getNextStatement(node: TSESTree.VariableDeclaration): TSESTree.Node | undefined {
    const statements = listSiblingStatements(node).filter((statement) => !isModuleDeclaration(statement));
    return statements[statements.indexOf(node) + 1];
}

export function getMemberRoot(node: TSESTree.Node): TSESTree.Node {
    let value = node;
    while (value.type === AST_NODE_TYPES.MemberExpression) value = value.object;
    return value;
}

export function unwrapExpression(node: TSESTree.Node): TSESTree.Node {
    let value = node;
    while (isUnwrappable(value)) value = value.expression;
    return value;
}

export function isAlias(node: TSESTree.Node | null, scope: TSESLint.Scope.Scope): boolean {
    if (node === null) return false;
    let value = unwrapExpression(node);
    while (value.type === AST_NODE_TYPES.MemberExpression && !value.computed) value = unwrapExpression(value.object);
    if (value.type !== AST_NODE_TYPES.Identifier) return false;
    const variable = ASTUtils.findVariable(scope, value);
    return (
        variable !== null &&
        variable.defs.length > 0 &&
        variable.references.every(
            (reference) =>
                (!reference.isWrite() || reference.init === true) &&
                !isMemberWrite(getOutermostMember(reference.identifier)),
        )
    );
}

export function buildSourceVisitors(checkSource: (source: TSESTree.Node) => void): TSESLint.RuleListener {
    return {
        [IMPORT_SELECTOR]: ({ source }: ImportSource) => {
            if (source !== null) checkSource(source);
        },
        [IMPORT_EQUALS_SELECTOR]: ({ expression }: TSESTree.TSExternalModuleReference) => {
            checkSource(expression);
        },
        [REQUIRE_SELECTOR]: (call: TSESTree.CallExpression) => {
            const [argument] = call.arguments;
            if (argument !== undefined) checkSource(argument);
        },
    };
}

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

export function listChildren(node: TSESTree.Node, visitorKeys: TSESLint.SourceCode['visitorKeys']): TSESTree.Node[] {
    const values = (visitorKeys[node.type] ?? []).flatMap((key): unknown[] => [node[key as keyof TSESTree.Node]]);
    return values.flat().filter((child): child is TSESTree.Node => typeof child === 'object' && child !== null);
}

export function listBodyNodes(root: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Node[] {
    const nodes: TSESTree.Node[] = [];
    const pending = [root];
    let node = pending.pop();
    while (node !== undefined) {
        nodes.push(node);
        const children = listChildren(node, source.visitorKeys).filter((child) => !FUNCTION_NODES.has(child.type));
        pending.push(...children.toReversed());
        node = pending.pop();
    }
    return nodes;
}

export function isCallOf(node: TSESTree.Node, name: string): node is TSESTree.CallExpression {
    if (node.type !== AST_NODE_TYPES.CallExpression) return false;
    const { callee } = node;
    return ASTUtils.isIdentifier(callee) && callee.name === name;
}

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
