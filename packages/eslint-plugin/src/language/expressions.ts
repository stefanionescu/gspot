import { unwrapExpression } from './syntax.ts';
import type { MemberAssignment } from '../types/plugin.ts';
import { getAssignedValue, getQualifiedName } from './modules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

/**
Follow single assignments while retaining the expression that supplies the value.

@param node the expression to resolve.
@param source the current file and scopes.
@param seen bindings already followed along this path.
*/
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

@param node the object or binding to inspect.
@param source the current file and scopes.
@param seen objects already expanded along this path.
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
Resolve an explicit literal without evaluating calls or other runtime expressions.

@param node the value to resolve.
@param source the current file and scopes.
*/
export function getLiteralValue(
    node: TSESTree.Node | undefined,
    source: TSESLint.SourceCode,
): TSESTree.Literal['value'] | undefined {
    const value = getExpressionValue(node, source);
    if (value?.type !== AST_NODE_TYPES.Literal) return undefined;
    return value.value;
}

/**
List the values of call arguments, with the elements of array values in place of the arrays, as `app.use` accepts
middleware lists.

@param values the arguments.
@param source the current file and scopes.
@param seen arrays already expanded along this path.
*/
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

/**
List the object literals that a call passes at the argument positions that its qualified name selects.

@param node the call or the construction.
@param source the current file and scopes.
@param positions the argument positions of each qualified name.
*/
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

/**
Tell whether the run time builds part of a string expression. A template literal with an expression does, and so does
a concatenation with an operand other than a literal.

@param node the string expression.
*/
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

/**
Find the variable that a declaration or an assignment stores an expression in.

@param node the stored expression.
@param source the current file and scopes.
*/
export function findAssignedVariable(node: TSESTree.Node, source: TSESLint.SourceCode): TSESLint.Scope.Variable | null {
    const { parent } = node;
    let target: TSESTree.Node | null = null;
    if (parent?.type === AST_NODE_TYPES.VariableDeclarator) target = parent.id;
    else if (parent?.type === AST_NODE_TYPES.AssignmentExpression) target = parent.left;
    return ASTUtils.isIdentifier(target) ? ASTUtils.findVariable(source.getScope(target), target) : null;
}

/**
Find the variable and the property name of an assignment to a property of a variable, such as `form.uploadDir = path`.

@param node an assignment of any target.
@param source the current file and scopes.
*/
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
