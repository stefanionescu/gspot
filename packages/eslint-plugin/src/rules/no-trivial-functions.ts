import { TRIVIAL_STATEMENTS } from '#plugin/config/syntax.ts';
import { createRule, optionsSchema } from '#plugin/create-rule.ts';
import { totalStatements, hasConstructorState } from '#plugin/syntax.ts';
import type { TrivialFunctionsOptions } from '#plugin/types/function-content.ts';
import type { FunctionBinding, ImplementedFunction } from '#plugin/types/syntax.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { SHARED_READS, VALUE_PARENTS, EXPORT_REFERENCES } from '#plugin/config/function-references.ts';

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

// A literal array index used as a call target does not preserve the selected function identity.
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
    const owners: FunctionBinding[] = [];
    if (node.type !== AST_NODE_TYPES.ArrowFunctionExpression && node.id !== null) owners.push({ node, id: node.id });
    if (node.parent.type === AST_NODE_TYPES.VariableDeclarator) owners.push({ node: node.parent, id: node.parent.id });
    return owners.flatMap(({ node: owner, id }) =>
        source
            .getDeclaredVariables(owner)
            .filter((variable) => variable.identifiers.some((entry) => entry.range[0] === id?.range[0])),
    );
}

// Assertions change static types without introducing an observable function-value use.
/**
 * Unwrap static assertions around a function value without changing its consumer.
 * @param node the expression or declaration
 * @returns the value as observed by its parent expression
 */
function functionValue(node: TSESTree.Expression): TSESTree.Expression {
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
function isInlineValue(node: ImplementedFunction): boolean {
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
function isRecursive(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
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

// An exported API may have callers in other modules; a local helper must have at least two reads.
function isSharedFunction(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    const owner = node.parent.type === AST_NODE_TYPES.VariableDeclarator ? node.parent.parent : node;
    if (
        owner.parent.type === AST_NODE_TYPES.ExportNamedDeclaration ||
        owner.parent.type === AST_NODE_TYPES.ExportDefaultDeclaration
    )
        return true;
    const variables = bindings(node, source);
    return variables.some((variable) => {
        const reads = variable.references.filter(
            (reference) => reference.isRead() && reference.identifier.parent.type !== AST_NODE_TYPES.TSTypeQuery,
        );
        return (
            reads.length >= SHARED_READS ||
            reads.some(({ identifier }) => EXPORT_REFERENCES.has(identifier.parent.type))
        );
    });
}

// Accessors, overrides, decorators, and instance initialization carry language contracts.
function hasDeclaredSignature(node: ImplementedFunction): boolean {
    const parent = node.parent;
    if (parent.type === AST_NODE_TYPES.Property) return parent.kind !== 'init';
    if (parent.type !== AST_NODE_TYPES.MethodDefinition) return false;
    if (parent.kind === 'constructor') return hasConstructorState(node);
    return parent.kind !== 'method' || parent.override || ('decorators' in parent && parent.decorators.length > 0);
}

// Type information connects an instance method to the interface or base class that requires it.
function hasInheritedContract(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    const method = node.parent;
    if (method.type !== AST_NODE_TYPES.MethodDefinition || method.static) return false;
    const owner = method.parent.parent;
    if (source.parserServices === undefined) return false;
    const { program, esTreeNodeToTSNodeMap: mapping } = source.parserServices;
    if (!program || !mapping) return false;
    const checker = program.getTypeChecker();
    const symbol = checker.getSymbolAtLocation(mapping.get(method.key));
    if (symbol === undefined) return false;
    return (mapping.get(owner).heritageClauses ?? []).some((clause) =>
        clause.types.some(
            (contract) => checker.getTypeAtLocation(contract).getProperty(symbol.getName()) !== undefined,
        ),
    );
}

// Each exemption identifies a language contract or an existing shared API.
function isRequiredFunction(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    if (node.returnType?.typeAnnotation.type === AST_NODE_TYPES.TSTypePredicate) return true;
    if (isInlineValue(node)) return true;
    if (isRecursive(node, source)) return true;
    if (isSharedFunction(node, source)) return true;
    if (hasDeclaredSignature(node)) return true;
    return hasInheritedContract(node, source);
}

export const noTrivialFunctions = createRule<TrivialFunctionsOptions, 'trivial'>({
    name: 'no-trivial-functions',
    meta: {
        defaultOptions: [{ maxStatements: TRIVIAL_STATEMENTS }],
        type: 'suggestion',
        docs: {
            title: 'Keep functions substantive',
            example:
                'The function `function one() { return 1; }` reports `trivial` at the default limit of two statements. Replace its calls with the value `1` and delete the function. A function written inline as an argument keeps its place, because the call takes a function.',
            level: 'all',
            description:
                'Reports named functions with two statements or fewer at the default limit.\n\n- The count includes nested callbacks.\n- Exempts inline function values, recursive functions, and type predicates.\n- Accessors, overrides, and decorated methods retain their language contracts.\n- Constructors that set state remain exempt.\n- The inherited-method exemption needs type information.\n- Exported functions and helpers with two or more lexical reads remain shared implementations.',
            why: 'An unnecessary function adds another name and another place to read.',
            fix: 'Inline the function at its call sites and delete it. A required external API keeps the function under a narrow suppression with a reason.',
        },
        schema: [optionsSchema({ maxStatements: { type: 'integer', minimum: 1 } })],
        messages: {
            trivial:
                'This function has {{statements}}. Functions with {{max}} or fewer are reported. Inline it into its callers, or explain the API it serves in a narrow suppression.',
        },
    },
    create(context, [options]) {
        const max = options.maxStatements;
        return {
            ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression):exit'(
                node: ImplementedFunction,
            ) {
                const count = totalStatements(node, context.sourceCode.visitorKeys);
                if (count > max || isRequiredFunction(node, context.sourceCode)) return;
                context.report({
                    node,
                    messageId: 'trivial',
                    data: { statements: count === 1 ? '1 statement' : `${String(count)} statements`, max },
                });
            },
        };
    },
});
