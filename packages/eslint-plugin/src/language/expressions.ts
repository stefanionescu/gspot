import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import type { MemberAssignment } from '../types/plugin.ts';
import { getAssignedValue, getQualifiedName } from './modules.ts';
import { unwrapExpression } from './syntax.ts';

export function getExpressionValue(
    node: TSESTree.Node | undefined,
    source: TSESLint.SourceCode,
    seen = new Set<TSESTree.Node>(),
): TSESTree.Node | undefined {
    if (node === undefined || seen.has(node)) return undefined;
    seen.add(node);
    const value = unwrapExpression(node);
    if (value.type !== AST_NODE_TYPES.Identifier) return value;
    const variable = ASTUtils.findVariable(source.getScope(value), value);
    return variable === null ? undefined : getExpressionValue(getAssignedValue(variable), source, seen);
}

/**
Get statically known object properties. Later properties and known spreads replace earlier values.
*/
export function getOptionProperties(
    node: TSESTree.Node | undefined,
    source: TSESLint.SourceCode,
    seen = new Set<TSESTree.Node>(),
): Map<string, TSESTree.Property> {
    let properties = new Map<string, TSESTree.Property>();
    const value = getExpressionValue(node, source);
    if (value?.type !== AST_NODE_TYPES.ObjectExpression || seen.has(value)) return properties;
    seen.add(value);
    for (const property of value.properties) {
        if (property.type === AST_NODE_TYPES.SpreadElement) {
            properties = new Map([...properties, ...getOptionProperties(property.argument, source, new Set(seen))]);
            continue;
        }
        const name = ASTUtils.getPropertyName(property, source.getScope(property));
        if (name !== null) properties.set(name, property);
    }
    return properties;
}

/**
Read one option of an options object. The value is evaluated in the scope that writes it, which a call in another
scope does not share.
*/
export function getOptionValue(
    options: TSESTree.Node | undefined,
    key: string,
    source: TSESLint.SourceCode,
): { property: TSESTree.Property; value: unknown; isKnown: boolean } | undefined {
    const property = getOptionProperties(options, source).get(key);
    if (property === undefined) return undefined;
    const found = ASTUtils.getStaticValue(property.value, source.getScope(property.value));
    return { property, value: found?.value, isKnown: found !== null };
}

export function getStaticString(node: TSESTree.Node | undefined, source: TSESLint.SourceCode): string | undefined {
    const evaluated = node && ASTUtils.getStaticValue(node, source.getScope(node));
    if (typeof evaluated?.value !== 'string') return undefined;
    return evaluated.value;
}

export function getLiteralValue(
    node: TSESTree.Node | undefined,
    source: TSESLint.SourceCode,
): TSESTree.Literal['value'] | undefined {
    const value = getExpressionValue(node, source);
    if (value?.type !== AST_NODE_TYPES.Literal) return undefined;
    return value.value;
}

export function listArgumentValues(
    values: readonly TSESTree.Node[],
    source: TSESLint.SourceCode,
    seen: ReadonlySet<TSESTree.Node> = new Set(),
): TSESTree.Node[] {
    return values.flatMap((value) => {
        const written = getExpressionValue(value, source) ?? value;
        if (written.type !== AST_NODE_TYPES.ArrayExpression) return [written];
        if (seen.has(written)) return [];
        return listArgumentValues(
            written.elements.filter((element) => element !== null),
            source,
            new Set([...seen, written]),
        );
    });
}

export function listOptionLiterals(
    node: TSESTree.CallExpression | TSESTree.NewExpression,
    source: TSESLint.SourceCode,
    positions: Readonly<Record<string, readonly number[]>>,
): TSESTree.ObjectExpression[] {
    const name = getQualifiedName(node, source);
    const indexes = name !== undefined && Object.hasOwn(positions, name) ? positions[name] : undefined;
    return (indexes ?? []).flatMap((index) => {
        const value = getExpressionValue(node.arguments[index], source);
        return value?.type === AST_NODE_TYPES.ObjectExpression ? [value] : [];
    });
}

export function isDynamicString(node: TSESTree.Node): boolean {
    if (node.type === AST_NODE_TYPES.TemplateLiteral) return node.expressions.length > 0;
    if (node.type !== AST_NODE_TYPES.BinaryExpression || node.operator !== '+') return false;
    const [isLeftLiteral, isRightLiteral] = [node.left, node.right].map(
        (operand) =>
            operand.type === AST_NODE_TYPES.Literal ||
            (operand.type === AST_NODE_TYPES.TemplateLiteral && operand.expressions.length === 0),
    );
    if (isRightLiteral !== true) return true;
    return node.left.type === AST_NODE_TYPES.BinaryExpression ? isDynamicString(node.left) : isLeftLiteral !== true;
}

export function findAssignedVariable(node: TSESTree.Node, source: TSESLint.SourceCode): TSESLint.Scope.Variable | null {
    const { parent } = node;
    let target: TSESTree.Node | null = null;
    if (parent?.type === AST_NODE_TYPES.VariableDeclarator) target = parent.id;
    else if (parent?.type === AST_NODE_TYPES.AssignmentExpression) target = parent.left;
    return ASTUtils.isIdentifier(target) ? ASTUtils.findVariable(source.getScope(target), target) : null;
}

export function findMemberAssignment(
    node: TSESTree.AssignmentExpression,
    source: TSESLint.SourceCode,
): MemberAssignment | undefined {
    const { left } = node;
    if (left.type !== AST_NODE_TYPES.MemberExpression || !ASTUtils.isIdentifier(left.object)) return undefined;
    const variable = ASTUtils.findVariable(source.getScope(left), left.object);
    const property = ASTUtils.getPropertyName(left);
    return variable === null || property === null ? undefined : { variable, property };
}
