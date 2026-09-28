import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { FUNCTION_REFERENCE_WRAPPERS } from '#plugin/constants/plugin.ts';
import type { FunctionUsage, ImplementedFunction } from '#plugin/types/rules.ts';
import type { Identifier, Node, Program, Symbol, TypeChecker } from 'typescript';

import {
    forEachChild,
    getNameOfDeclaration,
    isCallExpression,
    isIdentifier,
    isImportOrExportSpecifier,
    isTypeNode,
    isPropertyAccessExpression,
    isShorthandPropertyAssignment,
    isVariableDeclaration,
    SymbolFlags,
} from 'typescript';

const referenceIndex = new WeakMap<Program, Map<Symbol, FunctionUsage>>();

// Type assertions and parentheses do not change whether the consumer immediately invokes a value.
function isDirectCall(node: Node): boolean {
    let value = node;
    while (FUNCTION_REFERENCE_WRAPPERS.has(value.parent.kind)) value = value.parent;
    return isCallExpression(value.parent) && value.parent.expression === value;
}

// Declarations, type queries, and direct calls do not require a separately observable function value.
function isValueUse(node: Identifier): boolean {
    const parent = node.parent;
    if (isImportOrExportSpecifier(parent)) return false;
    if (
        'name' in parent &&
        parent.name === node &&
        !isPropertyAccessExpression(parent) &&
        !isShorthandPropertyAssignment(parent)
    )
        return false;
    const value = isPropertyAccessExpression(parent) && parent.name === node ? parent : node;
    return !isDirectCall(value);
}

// Alias identity belongs to its declaration, including shorthand object properties.
function resolvedSymbol(node: Identifier, checker: TypeChecker): Symbol | undefined {
    const symbol = isShorthandPropertyAssignment(node.parent)
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : checker.getSymbolAtLocation(node);
    if (symbol === undefined) return undefined;
    return (symbol.flags & SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol);
}

function recordProgramReference(node: Identifier, checker: TypeChecker, references: Map<Symbol, FunctionUsage>): void {
    const value = isPropertyAccessExpression(node.parent) && node.parent.name === node ? node.parent : node;
    const call = isDirectCall(value);
    if (!call && !isValueUse(node)) return;
    const target = resolvedSymbol(node, checker);
    if (target === undefined) return;
    const usage = references.get(target) ?? { required: false, calls: 0 };
    if (call) usage.calls += 1;
    else usage.required = true;
    references.set(target, usage);
}

// Resolve imported aliases once for every source file in the type-checked program.
function programReferences(program: Program): Map<Symbol, FunctionUsage> {
    const cached = referenceIndex.get(program);
    if (cached !== undefined) return cached;
    const checker = program.getTypeChecker();
    const references = new Map<Symbol, FunctionUsage>();
    const visit = (node: Node): void => {
        if (isTypeNode(node)) return;
        forEachChild(node, visit);
        if (!isIdentifier(node)) return;
        recordProgramReference(node, checker, references);
    };
    for (const source of program.getSourceFiles())
        if (!source.isDeclarationFile && !program.isSourceFileFromExternalLibrary(source)) visit(source);
    referenceIndex.set(program, references);
    return references;
}

function programUsage(node: ImplementedFunction, source: TSESLint.SourceCode): FunctionUsage | undefined {
    const { program, esTreeNodeToTSNodeMap: mapping } = source.parserServices ?? {};
    if (!program || !mapping) return undefined;
    const implementation = mapping.get(node);
    const declaration = isVariableDeclaration(implementation.parent) ? implementation.parent : implementation;
    const name = getNameOfDeclaration(declaration);
    if (name === undefined || !isIdentifier(name)) return undefined;
    const symbol = resolvedSymbol(name, program.getTypeChecker());
    return symbol === undefined ? undefined : programReferences(program).get(symbol);
}

// Direct self-calls require the lexical binding; type references and exports do not consume it.
function lexicalReferenceKind(
    node: ImplementedFunction,
    identifier: TSESTree.Identifier | TSESTree.JSXIdentifier,
): 'ignored' | 'required' | 'call' {
    if (identifier.type === AST_NODE_TYPES.JSXIdentifier) return 'required';
    const value = functionValue(identifier);
    const use = value.parent;
    if (use.type === AST_NODE_TYPES.ExportSpecifier || use.type === AST_NODE_TYPES.TSTypeQuery) return 'ignored';
    if (use.type !== AST_NODE_TYPES.CallExpression || use.callee !== value) return 'required';
    const within = identifier.range[0] >= node.range[0] && identifier.range[1] <= node.range[1];
    return within ? 'required' : 'call';
}

function lexicalUsage(node: ImplementedFunction, source: TSESLint.SourceCode): FunctionUsage {
    const declarations = node.parent.type === AST_NODE_TYPES.VariableDeclarator ? [node.parent, node] : [node];
    const references = declarations.flatMap((declaration) => {
        if (!('id' in declaration) || declaration.id?.type !== AST_NODE_TYPES.Identifier) return [];
        const identifier = declaration.id;
        return source
            .getDeclaredVariables(declaration)
            .filter((entry) => entry.identifiers.includes(identifier))
            .flatMap((entry) => entry.references);
    });
    const usage: FunctionUsage = { required: false, calls: 0 };
    for (const reference of references.filter((entry) => entry.isRead())) {
        const kind = lexicalReferenceKind(node, reference.identifier);
        if (kind === 'required') usage.required = true;
        if (kind === 'call') usage.calls += 1;
    }
    return usage;
}

// Destructuring binds selected properties rather than forwarding the complete object value.
function bindingReferences(
    declaration: TSESTree.VariableDeclarator,
    source: TSESLint.SourceCode,
): TSESTree.Expression[] {
    if (declaration.id.type !== AST_NODE_TYPES.Identifier) return [];
    return source
        .getDeclaredVariables(declaration)
        .flatMap((variable) =>
            variable.references
                .filter((reference) => reference.isRead())
                .flatMap(({ identifier }) => (identifier.type === AST_NODE_TYPES.Identifier ? [identifier] : [])),
        );
}

// Follow object values through lexical aliases and literal containers, without treating member calls as escapes.
function forwardedExpressions(value: TSESTree.Expression, source: TSESLint.SourceCode): TSESTree.Expression[] {
    const parent = value.parent;
    switch (parent.type) {
        case AST_NODE_TYPES.VariableDeclarator: {
            return bindingReferences(parent, source);
        }
        case AST_NODE_TYPES.Property: {
            return parent.value === value && parent.parent.type === AST_NODE_TYPES.ObjectExpression
                ? [parent.parent]
                : [];
        }
        case AST_NODE_TYPES.SpreadElement: {
            return parent.parent.type === AST_NODE_TYPES.ObjectExpression ? [parent.parent] : [];
        }
        case AST_NODE_TYPES.ArrayExpression: {
            return [parent];
        }
        default: {
            return [];
        }
    }
}

// Consumers outside direct member invocation can observe each callback's signature and identity.
function isConsumedExpression(
    value: TSESTree.Expression,
    source: TSESLint.SourceCode,
    seen: Set<TSESTree.Expression>,
): boolean {
    const expression = functionValue(value);
    if (seen.has(expression)) return false;
    seen.add(expression);
    const parent = expression.parent;
    if (parent.type === AST_NODE_TYPES.ReturnStatement || parent.type === AST_NODE_TYPES.JSXExpressionContainer)
        return true;
    if (parent.type === AST_NODE_TYPES.CallExpression || parent.type === AST_NODE_TYPES.NewExpression)
        return parent.arguments.includes(expression);
    return forwardedExpressions(expression, source).some((next) => isConsumedExpression(next, source, seen));
}

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

// Assertions change static types without introducing an observable function-value use.
export function functionValue(node: TSESTree.Expression): TSESTree.Expression;
export function functionValue(node: ImplementedFunction): TSESTree.Expression | ImplementedFunction;
/**
 * Unwrap static assertions around a function value without changing its consumer.
 * @param node the expression or declaration
 * @returns the value as observed by its parent expression
 */
export function functionValue(
    node: TSESTree.Expression | ImplementedFunction,
): TSESTree.Expression | ImplementedFunction {
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
 * Resolve value uses, self-calls, and distinct call sites through lexical bindings and imported aliases.
 * @param node the function implementation
 * @param source the parser source and available type services
 * @returns required identity and the number of direct call sites
 */
export function functionUsage(node: ImplementedFunction, source: TSESLint.SourceCode): FunctionUsage {
    const local = lexicalUsage(node, source);
    const program = programUsage(node, source);
    return {
        required: local.required || program?.required === true,
        calls: Math.max(local.calls, program?.calls ?? 0),
    };
}

/**
 * Identify syntax whose consumer requires a function value rather than an immediate call.
 * @param node the function implementation
 * @returns whether the function is passed or returned as a value
 */
export function isCallbackValue(node: ImplementedFunction): boolean {
    if (node.type === AST_NODE_TYPES.FunctionDeclaration) return false;
    const value = functionValue(node);
    const parent = value.parent;
    if (parent.type === AST_NODE_TYPES.ArrayExpression) return !isArrayElementCall(parent);
    if (parent.type === AST_NODE_TYPES.ReturnStatement || parent.type === AST_NODE_TYPES.JSXExpressionContainer)
        return true;
    if (parent.type !== AST_NODE_TYPES.CallExpression && parent.type !== AST_NODE_TYPES.NewExpression) return false;
    return parent.arguments.includes(value);
}

/**
 * Identify callbacks carried by objects that are passed or returned to a consumer.
 * @param node the function implementation
 * @param source the parser source and lexical bindings
 * @returns whether the containing object has an observable value use
 */
export function isCallbackProperty(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    if (node.type === AST_NODE_TYPES.FunctionDeclaration) return false;
    const value = functionValue(node);
    const property = value.parent;
    if (property.type !== AST_NODE_TYPES.Property || property.value !== value) return false;
    if (property.parent.type !== AST_NODE_TYPES.ObjectExpression) return false;
    return isConsumedExpression(property.parent, source, new Set());
}
