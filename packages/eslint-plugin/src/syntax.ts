import type { ImplementedFunction } from './types/syntax.ts';
import { ZOD_MODULES, ZOD_SCHEMA_FACTORIES, ZOD_SCHEMA_NAMESPACES } from './config/schemas.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    TYPE_ONLY,
    FUNCTION_TYPES,
    UNWRAPPABLE_NODES,
    IMPORT_SPECIFIER_NODES,
    EXECUTABLE_DECLARATIONS,
    TRANSPARENT_EXPRESSIONS,
    NON_EXECUTABLE_STATEMENTS,
} from './config/syntax.ts';

const isUnwrappable = ASTUtils.isNodeOfTypes(UNWRAPPABLE_NODES.map((type) => AST_NODE_TYPES[type]));

const isTransparentExpression = ASTUtils.isNodeOfTypes(TRANSPARENT_EXPRESSIONS.map((type) => AST_NODE_TYPES[type]));

// Walk only the visitor keys of the parser, which leave out metadata and parent links.
function listChildNodes(
    node: TSESTree.Node,
    visitorKeys: Readonly<Record<string, readonly string[]>>,
): TSESTree.Node[] {
    return (visitorKeys[node.type] ?? []).flatMap((key) => {
        const child: unknown = node[key as keyof TSESTree.Node];
        if (Array.isArray(child)) return child.filter((item: unknown) => item !== null) as TSESTree.Node[];
        return child !== null && typeof child === 'object' ? [child as TSESTree.Node] : [];
    });
}

function isTypeImportReference(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    let value = node;
    while (value.type === AST_NODE_TYPES.CallExpression || value.type === AST_NODE_TYPES.MemberExpression)
        value = value.type === AST_NODE_TYPES.CallExpression ? value.callee : value.object;
    if (value.type !== AST_NODE_TYPES.Identifier) return false;
    return (
        ASTUtils.findVariable(source.getScope(node), value)?.defs.some(
            ({ node: declaration }) =>
                IMPORT_SPECIFIER_NODES.has(declaration.type) &&
                declaration.parent.type === AST_NODE_TYPES.ImportDeclaration &&
                (declaration.parent.importKind === 'type' ||
                    (declaration.type === AST_NODE_TYPES.ImportSpecifier && declaration.importKind === 'type')),
        ) === true
    );
}

/**
 * Walk through type assertions and conditional or logical expressions to the outermost value.
 *
 * @param node the expression
 * @returns the outermost expression that wraps it
 */
export function findOutermostValue(node: TSESTree.Expression): TSESTree.Expression {
    let value = node;
    while (isTransparentExpression(value.parent)) value = value.parent;
    return value;
}

/**
 * Count the executable statements under a node, nested functions included. An expression body counts as one.
 *
 * @param node the function body, or anything inside it
 * @param visitorKeys the child keys of each node type, from the parser
 * @returns the statement count
 */
export function countStatements(node: TSESTree.Node, visitorKeys: Readonly<Record<string, readonly string[]>>): number {
    if (TYPE_ONLY.has(node.type)) return 0;
    if ('declare' in node && node.declare) return 0;
    const isExpressionBody =
        FUNCTION_TYPES.has(node.type) && (node as ImplementedFunction).body.type !== AST_NODE_TYPES.BlockStatement;
    const isStatement = node.type.endsWith('Statement') && !NON_EXECUTABLE_STATEMENTS.has(node.type);
    const own = Number(isExpressionBody || isStatement || EXECUTABLE_DECLARATIONS.has(node.type));
    return listChildNodes(node, visitorKeys).reduce((total, child) => total + countStatements(child, visitorKeys), own);
}

/**
 * Strip the wrappers that keep the runtime value: type assertions and optional chains.
 *
 * @param node the expression, or null
 * @returns the inner expression
 */
export function unwrap(node: TSESTree.Node | null): TSESTree.Node | null {
    let value = node;
    while (value !== null && isUnwrappable(value)) value = value.expression;
    return value;
}

/**
 * Find schema factory calls through their Zod imports, including aliased bindings.
 *
 * @param source the parsed module and its scopes
 * @returns calls that construct runtime validation schemas
 */
export function findZodSchemaConstructors(source: TSESLint.SourceCode): TSESTree.Node[] {
    const factories = Object.fromEntries(
        ZOD_SCHEMA_FACTORIES.map((name) => [name, { [ASTUtils.ReferenceTracker.CALL]: true }]),
    );
    const namespaces = Object.fromEntries(
        Object.entries(ZOD_SCHEMA_NAMESPACES).map(([name, methods]) => [
            name,
            Object.fromEntries(methods.map((method) => [method, { [ASTUtils.ReferenceTracker.CALL]: true }])),
        ]),
    );
    const constructors = { ...factories, ...namespaces };
    const imports = Object.fromEntries(
        ZOD_MODULES.map((name) => [
            name,
            { [ASTUtils.ReferenceTracker.ESM]: true, ...constructors, z: constructors, default: constructors },
        ]),
    );
    const tracker = new ASTUtils.ReferenceTracker(source.getScope(source.ast));
    return [...tracker.iterateEsmReferences(imports)]
        .filter((reference) => !isTypeImportReference(reference.node, source))
        .map((reference) => reference.node);
}
