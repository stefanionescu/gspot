import { createRule, optionsSchema } from '../create-rule.ts';
import type { TrivialFunctionsOptions } from '../types/rules.ts';
import type { NamedFunction, ImplementedFunction } from '../types/syntax.ts';
import { totalStatements, ownsCalculation, hasConstructorState } from '../syntax.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    VALUE_PARENTS,
    MIN_SHARED_READS,
    FUNCTION_SELECTOR,
    EXPORT_REFERENCES,
    TRIVIAL_STATEMENTS,
    TRANSPARENT_EXPRESSIONS,
} from '../config/syntax.ts';

const isTransparentExpression = ASTUtils.isNodeOfTypes(TRANSPARENT_EXPRESSIONS.map((type) => AST_NODE_TYPES[type]));

// Parents that hold a function value in one of their positions, with the test for that position.
const VALUE_HOLDERS: [AST_NODE_TYPES, (parent: TSESTree.Node, value: TSESTree.Node) => boolean][] = [
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

// The names callers can use for a function: its own name and the variable that holds it.
function callableVariables(node: ImplementedFunction, source: TSESLint.SourceCode): TSESLint.Scope.Variable[] {
    const owners: NamedFunction[] = [];
    if (node.type !== AST_NODE_TYPES.ArrowFunctionExpression && node.id !== null) owners.push({ node, id: node.id });
    if (node.parent.type === AST_NODE_TYPES.VariableDeclarator) owners.push({ node: node.parent, id: node.parent.id });
    return owners.flatMap(({ node: owner, id }) =>
        source
            .getDeclaredVariables(owner)
            .filter((variable) => variable.identifiers.some((entry) => entry.range[0] === id?.range[0])),
    );
}

/**
 * Find the consumer of a function value through assertions and conditional or logical expressions.
 * @param node the expression or declaration
 * @returns the value as observed by its parent expression
 */
function outermostValue(node: TSESTree.Expression): TSESTree.Expression {
    let value = node;
    while (isTransparentExpression(value.parent)) {
        const parent = value.parent;
        value = parent;
    }
    return value;
}

/**
 * Identify a function whose position requires a function value: an argument, a returned value, an element,
 * a property, an assigned member, or JSX. The consumer takes a function, so the position needs one.
 * @param node the function implementation
 * @returns whether the position takes an inline function
 */
function isInlineValue(node: ImplementedFunction): boolean {
    if (node.type === AST_NODE_TYPES.FunctionDeclaration) return false;
    const value = outermostValue(node);
    const parent = value.parent;
    if (parent.type === AST_NODE_TYPES.ArrayExpression || VALUE_PARENTS.has(parent.type)) return true;
    return VALUE_HOLDERS.find(([type]) => type === parent.type)?.[1](parent, value) ?? false;
}

/**
 * Identify a function that calls itself. Its body names the function, so callers cannot replace it with that body.
 * @param node the function implementation
 * @param source the parser source and lexical bindings
 * @returns whether a reference to the function sits inside its own body
 */
function isRecursive(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    return callableVariables(node, source)
        .flatMap((variable) => variable.references)
        .some(
            (reference) =>
                reference.isRead() &&
                reference.identifier.parent.type !== AST_NODE_TYPES.TSTypeQuery &&
                reference.identifier.range[0] >= node.range[0] &&
                reference.identifier.range[1] <= node.range[1],
        );
}

// An exported API may have callers in other modules. A local helper must have at least two reads.
function isSharedFunction(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    const owner = node.parent.type === AST_NODE_TYPES.VariableDeclarator ? node.parent.parent : node;
    if (
        owner.parent.type === AST_NODE_TYPES.ExportNamedDeclaration ||
        owner.parent.type === AST_NODE_TYPES.ExportDefaultDeclaration
    )
        return true;
    const variables = callableVariables(node, source);
    return variables.some((variable) => {
        const reads = variable.references.filter(
            (reference) => reference.isRead() && reference.identifier.parent.type !== AST_NODE_TYPES.TSTypeQuery,
        );
        return (
            reads.length >= MIN_SHARED_READS ||
            reads.some(({ identifier }) => EXPORT_REFERENCES.has(identifier.parent.type))
        );
    });
}

// Empty and argument-forwarding constructors already belong to no-useless-constructor.
function isRedundantConstructor(node: TSESTree.FunctionExpression): boolean {
    if (node.body.body.length === 0) return true;
    const [statement] = node.body.body;
    if (
        node.body.body.length !== 1 ||
        statement?.type !== AST_NODE_TYPES.ExpressionStatement ||
        statement.expression.type !== AST_NODE_TYPES.CallExpression ||
        statement.expression.callee.type !== AST_NODE_TYPES.Super
    )
        return false;
    const args = statement.expression.arguments;
    return (
        args.length === node.params.length &&
        args.every(
            (argument, index) =>
                argument.type === AST_NODE_TYPES.Identifier &&
                node.params[index]?.type === AST_NODE_TYPES.Identifier &&
                argument.name === node.params[index].name,
        )
    );
}

// Accessors, overrides, decorators, and instance initialization carry language contracts.
function hasDeclaredSignature(node: ImplementedFunction): boolean {
    const parent = node.parent;
    if (parent.type === AST_NODE_TYPES.Property) return parent.kind !== 'init';
    if (parent.type !== AST_NODE_TYPES.MethodDefinition) return false;
    if (parent.kind === 'constructor')
        return (
            hasConstructorState(node) ||
            (node.type === AST_NODE_TYPES.FunctionExpression && isRedundantConstructor(node))
        );
    return parent.kind !== 'method' || parent.override || parent.decorators.length > 0;
}

// Type information connects an instance method to the interface or base class that requires it.
function isInheritedMethod(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
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
    if (ownsCalculation(node.body, source.visitorKeys)) return true;
    if (isInlineValue(node)) return true;
    if (isRecursive(node, source)) return true;
    if (isSharedFunction(node, source)) return true;
    if (hasDeclaredSignature(node)) return true;
    return isInheritedMethod(node, source);
}

export const noTrivialFunctions = createRule<TrivialFunctionsOptions, 'trivial'>({
    name: 'no-trivial-functions',
    meta: {
        defaultOptions: [{ trivialStatements: TRIVIAL_STATEMENTS }],
        type: 'suggestion',
        docs: {
            example:
                'The function `function one() { return 1; }` reports `trivial` at the default limit of two statements. Replace its calls with the value `1` and delete the function. A function written inline as an argument keeps its place, because the call takes a function.',
            level: 'all',
            description:
                'Reports named functions with two statements or fewer at the default limit.\n\n- The count includes nested callbacks.\n- Exempts inline function values, recursive functions, and type predicates.\n- Accessors, overrides, and decorated methods retain their language contracts.\n- Constructors that set state remain exempt.\n- The inherited-method exemption needs type information.\n- A function used in two or more places, or exported, is not reported.',
            why: 'An unnecessary function adds another name and another place to read.',
            fix: 'Inline the function at its call sites and delete it.',
        },
        schema: [
            optionsSchema({
                trivialStatements: {
                    description: 'Functions with this many statements or fewer are reported.',
                    type: 'integer',
                    minimum: 1,
                },
            }),
        ],
        messages: {
            trivial: 'This function has {{statements}}. Inline it into its callers and delete it.',
        },
    },
    create(context, [options]) {
        const max = options.trivialStatements;
        return {
            [`${FUNCTION_SELECTOR}:exit`](node: ImplementedFunction) {
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
