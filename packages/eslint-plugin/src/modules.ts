import { unwrapExpression } from './syntax.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function readImportSpecifier(node: TSESTree.ImportSpecifier, module: string): string | undefined {
    if (node.importKind === 'type') return undefined;
    const name = node.imported.type === AST_NODE_TYPES.Identifier ? node.imported.name : node.imported.value;
    return name === 'default' ? module : `${module}.${name}`;
}

function readImportedName(
    node: TSESTree.Node,
    source: TSESLint.SourceCode,
    seen: Set<TSESTree.Node>,
): string | undefined {
    if (node.type === AST_NODE_TYPES.TSImportEqualsDeclaration)
        return readModuleName(node.moduleReference, source, seen);
    if (node.parent?.type !== AST_NODE_TYPES.ImportDeclaration || node.parent.importKind === 'type') return undefined;
    const module = node.parent.source.value;
    return node.type === AST_NODE_TYPES.ImportSpecifier ? readImportSpecifier(node, module) : module;
}

function readCalledModule(
    node: TSESTree.CallExpression,
    source: TSESLint.SourceCode,
    seen: Set<TSESTree.Node>,
): string | undefined {
    const argument = node.arguments[0];
    if (node.callee.type !== AST_NODE_TYPES.Identifier || node.callee.name !== 'require')
        return readModuleName(node.callee, source, seen);
    return argument?.type === AST_NODE_TYPES.Literal && typeof argument.value === 'string' ? argument.value : undefined;
}

function readDestructuredName(identifier: TSESTree.Node, module: string): string | undefined {
    if (identifier.type !== AST_NODE_TYPES.Identifier) return undefined;
    const { parent } = identifier;
    if (parent.type !== AST_NODE_TYPES.Property || parent.value !== identifier) return undefined;
    const property = ASTUtils.getPropertyName(parent);
    if (property === null) return undefined;
    return property === 'default' ? module : `${module}.${property}`;
}

/**
Resolve a binding only when one write supplies its value.

@param variable the binding whose initializer or assignment to follow.
*/
export function readAssignedValue(variable: TSESLint.Scope.Variable): TSESTree.Node | undefined {
    const writes = variable.references.filter((reference) => reference.isWrite());
    if (writes.length !== 1) return undefined;
    return writes[0]?.writeExpr ?? undefined;
}

function readBoundModule(
    node: TSESTree.Identifier,
    source: TSESLint.SourceCode,
    seen: Set<TSESTree.Node>,
): string | undefined {
    const variable = ASTUtils.findVariable(source.getScope(node), node);
    if (variable === null) return undefined;
    const definition = variable.defs[0];
    if (definition === undefined) return node.name;
    const imported = readImportedName(definition.node, source, seen);
    if (imported !== undefined) return imported;
    if (definition.node.type !== AST_NODE_TYPES.VariableDeclarator) return undefined;
    const value = readAssignedValue(variable);
    if (value === undefined) return undefined;
    const module = readModuleName(value, source, seen);
    if (module === undefined || definition.node.id.type === AST_NODE_TYPES.Identifier) return module;
    return readDestructuredName(definition.name, module);
}

function readMemberProperty(
    node: TSESTree.MemberExpression | TSESTree.TSQualifiedName,
    source: TSESLint.SourceCode,
): string | null {
    if (node.type === AST_NODE_TYPES.TSQualifiedName) return node.right.name;
    const property = ASTUtils.getPropertyName(node, source.getScope(node));
    if (property !== null) return property;
    return node.property.type === AST_NODE_TYPES.Identifier ? node.property.name : null;
}

function readMemberModule(
    node: TSESTree.MemberExpression | TSESTree.TSQualifiedName,
    source: TSESLint.SourceCode,
    seen: Set<TSESTree.Node>,
): string | undefined {
    const receiver = node.type === AST_NODE_TYPES.MemberExpression ? node.object : node.left;
    const module = readModuleName(receiver, source, seen);
    const property = readMemberProperty(node, source);
    return module === undefined || property === null ? undefined : `${module}.${property}`;
}

/**
Follow imported, required, global, and aliased values to their qualified names.

@param node the referenced value.
@param source the current file and its scopes.
@param seen expressions already followed in this resolution.
*/
export function readModuleName(
    node: TSESTree.Node,
    source: TSESLint.SourceCode,
    seen = new Set<TSESTree.Node>(),
): string | undefined {
    const value = unwrapExpression(node);
    if (seen.has(value)) return undefined;
    seen.add(value);
    switch (value.type) {
        case AST_NODE_TYPES.Identifier: {
            return readBoundModule(value, source, seen);
        }
        case AST_NODE_TYPES.CallExpression: {
            return readCalledModule(value, source, seen);
        }
        case AST_NODE_TYPES.TSQualifiedName:
        case AST_NODE_TYPES.MemberExpression: {
            return readMemberModule(value, source, seen);
        }
        case AST_NODE_TYPES.TSExternalModuleReference: {
            return value.expression.value;
        }
        default: {
            return undefined;
        }
    }
}
