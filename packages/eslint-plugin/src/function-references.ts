import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { ImplementedFunction } from '#plugin/types/plugin.ts';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

// Positions whose parent always takes a function value.
const VALUE_PARENTS = new Set<AST_NODE_TYPES>([
    AST_NODE_TYPES.ReturnStatement,
    AST_NODE_TYPES.JSXExpressionContainer,
    AST_NODE_TYPES.ArrowFunctionExpression,
]); // A literal array index used as a call target does not preserve the selected function identity.
function isArrayElementCall(node: TSESTree.ArrayExpression): boolean {
    const array = functionValue(node);
    const reference = array.parent;
    if (reference.type !== AST_NODE_TYPES.MemberExpression || reference.object !== array || !reference.computed)
        return false;
    if (reference.property.type !== AST_NODE_TYPES.Literal || typeof reference.property.value !== 'number')
        return false;
    const member = functionValue(reference);
    const consumer = member.parent;
    return consumer.type === AST_NODE_TYPES.CallExpression && consumer.callee === member;
}

// The bindings a function can be called through: its own name, and the variable it is assigned to.
function bindings(node: ImplementedFunction, source: TSESLint.SourceCode): TSESLint.Scope.Variable[] {
    const owners: { node: TSESTree.Node; id: TSESTree.Node | null }[] = [];
    if (node.type !== AST_NODE_TYPES.ArrowFunctionExpression && node.id !== null) owners.push({ node, id: node.id });
    if (node.parent.type === AST_NODE_TYPES.VariableDeclarator) owners.push({ node: node.parent, id: node.parent.id });
    return owners.flatMap(({ node: owner, id }) =>
        source
            .getDeclaredVariables(owner)
            .filter((variable) => variable.identifiers.some((entry) => entry.range[0] === id?.range[0])),
    );
}

// Parents that hold a function value in one of their positions, with the test for that position.
const VALUE_HOLDERS: [AST_NODE_TYPES, (parent: TSESTree.Node, value: TSESTree.Node) => boolean][] = [
    [AST_NODE_TYPES.ArrayExpression, (parent) => !isArrayElementCall(parent as TSESTree.ArrayExpression)],
    [
        AST_NODE_TYPES.Property,
        (parent, value) =>
            (parent as TSESTree.Property).value === value && parent.parent?.type === AST_NODE_TYPES.ObjectExpression,
    ],
    [
        AST_NODE_TYPES.AssignmentExpression,
        (parent, value) =>
            (parent as TSESTree.AssignmentExpression).right === value &&
            (parent as TSESTree.AssignmentExpression).left.type === AST_NODE_TYPES.MemberExpression,
    ],
    [
        AST_NODE_TYPES.CallExpression,
        (parent, value) =>
            (parent as TSESTree.CallExpression).arguments.some((argument) => argument.range[0] === value.range[0]),
    ],
    [
        AST_NODE_TYPES.NewExpression,
        (parent, value) =>
            (parent as TSESTree.NewExpression).arguments.some((argument) => argument.range[0] === value.range[0]),
    ],
];

// Assertions change static types without introducing an observable function-value use.
function functionValue(node: TSESTree.Expression): TSESTree.Expression;
function functionValue(node: ImplementedFunction): TSESTree.Expression | ImplementedFunction;
/**
 * Unwrap static assertions around a function value without changing its consumer.
 * @param node the expression or declaration
 * @returns the value as observed by its parent expression
 */
function functionValue(node: TSESTree.Expression | ImplementedFunction): TSESTree.Expression | ImplementedFunction {
    let value = node;
    for (;;) {
        const parent = value.parent;
        switch (parent.type) {
            case AST_NODE_TYPES.TSAsExpression:
            case AST_NODE_TYPES.TSTypeAssertion:
            case AST_NODE_TYPES.TSSatisfiesExpression:
            case AST_NODE_TYPES.TSNonNullExpression:
            case AST_NODE_TYPES.TSInstantiationExpression: {
                value = parent;
                break;
            }
            default: {
                return value;
            }
        }
    }
}

/**
 * Identify a function written where a function value is needed: an argument, a returned value, an element,
 * a property, an assigned member, or JSX. Nothing can be inlined there, because the consumer takes a function.
 * @param node the function implementation
 * @returns whether the function is an inline value
 */
export function isInlineValue(node: ImplementedFunction): boolean {
    if (node.type === AST_NODE_TYPES.FunctionDeclaration) return false;
    const value = functionValue(node);
    const parent = value.parent;
    if (VALUE_PARENTS.has(parent.type)) return true;
    return VALUE_HOLDERS.find(([type]) => type === parent.type)?.[1](parent, value) ?? false;
}

/**
 * Identify a function that calls itself. It cannot be inlined, because the body names the binding.
 * @param node the function implementation
 * @param source the parser source and lexical bindings
 * @returns whether a reference to the function sits inside its own body
 */
export function isRecursive(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    return bindings(node, source)
        .flatMap((variable) => variable.references)
        .some(
            (reference) =>
                reference.isRead() &&
                reference.identifier.parent.type !== AST_NODE_TYPES.TSTypeQuery &&
                reference.identifier.range[0] >= node.range[0] &&
                reference.identifier.range[1] <= node.range[1],
        );
}
