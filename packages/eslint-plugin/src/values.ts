import { unwrapExpression } from './syntax.ts';
import { readAssignedValue } from './modules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

/**
Follow single assignments while retaining the expression that supplies the value.

@param node the expression to resolve.
@param source the current file and scopes.
@param seen bindings already followed along this path.
*/
export function readExpressionValue(
    node: TSESTree.Node | undefined,
    source: TSESLint.SourceCode,
    seen = new Set<TSESTree.Node>(),
): TSESTree.Node | undefined {
    if (node === undefined || seen.has(node)) return undefined;
    seen.add(node);
    const value = unwrapExpression(node);
    if (value.type !== AST_NODE_TYPES.Identifier) return value;
    const variable = ASTUtils.findVariable(source.getScope(value), value);
    if (variable === null) return undefined;
    return readExpressionValue(readAssignedValue(variable), source, seen);
}

/**
Read statically known object properties. Later properties and known spreads replace earlier values.

@param node the object or binding to inspect.
@param source the current file and scopes.
@param seen objects already expanded along this path.
*/
export function readOptionProperties(
    node: TSESTree.Node | undefined,
    source: TSESLint.SourceCode,
    seen = new Set<TSESTree.Node>(),
): Map<string, TSESTree.Property> {
    let properties = new Map<string, TSESTree.Property>();
    const value = readExpressionValue(node, source);
    if (value?.type !== AST_NODE_TYPES.ObjectExpression || seen.has(value)) return properties;
    seen.add(value);
    for (const property of value.properties) {
        if (property.type === AST_NODE_TYPES.SpreadElement) {
            properties = new Map([...properties, ...readOptionProperties(property.argument, source, new Set(seen))]);
            continue;
        }
        const name = ASTUtils.getPropertyName(property, source.getScope(property));
        if (name !== null) properties.set(name, property);
    }
    return properties;
}

/**
Resolve an explicit literal without evaluating calls or other runtime expressions.

@param node the value to resolve.
@param source the current file and scopes.
*/
export function readLiteralValue(
    node: TSESTree.Node | undefined,
    source: TSESLint.SourceCode,
): TSESTree.Literal['value'] | undefined {
    const value = readExpressionValue(node, source);
    if (value?.type !== AST_NODE_TYPES.Literal) return undefined;
    return value.value;
}
