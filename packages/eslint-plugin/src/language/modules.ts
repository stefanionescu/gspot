import { unwrapExpression } from './syntax.ts';
import type { CallText } from '../types/plugin.ts';
import { NODE_PREFIX, DRIVE_LETTER, TRAILING_SLASH, MODULE_SEPARATOR } from '../config/plugin.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getImportSpecifier(node: TSESTree.ImportSpecifier, module: string): string | undefined {
    if (node.importKind === 'type') return undefined;
    const name = node.imported.type === AST_NODE_TYPES.Identifier ? node.imported.name : node.imported.value;
    return name === 'default' ? module : `${module}.${name}`;
}

function getImportedName(
    node: TSESTree.Node,
    source: TSESLint.SourceCode,
    seen: Set<TSESTree.Node>,
): string | undefined {
    if (node.type === AST_NODE_TYPES.TSImportEqualsDeclaration)
        return getModuleName(node.moduleReference, source, seen);
    if (node.parent?.type !== AST_NODE_TYPES.ImportDeclaration || node.parent.importKind === 'type') return undefined;
    const module = node.parent.source.value;
    return node.type === AST_NODE_TYPES.ImportSpecifier ? getImportSpecifier(node, module) : module;
}

function getCalledModule(
    node: TSESTree.CallExpression,
    source: TSESLint.SourceCode,
    seen: Set<TSESTree.Node>,
): string | undefined {
    if (node.callee.type !== AST_NODE_TYPES.Identifier || node.callee.name !== 'require')
        return getModuleName(node.callee, source, seen);
    const argument = node.arguments[0];
    return argument?.type === AST_NODE_TYPES.Literal && typeof argument.value === 'string' ? argument.value : undefined;
}

function getDestructuredName(identifier: TSESTree.Node, module: string): string | undefined {
    const { parent } = identifier;
    const isValue = parent?.type === AST_NODE_TYPES.Property && parent.value === identifier;
    const property = isValue ? ASTUtils.getPropertyName(parent) : null;
    if (property === null) return undefined;
    return property === 'default' ? module : `${module}.${property}`;
}

function getBoundModule(
    node: TSESTree.Identifier,
    source: TSESLint.SourceCode,
    seen: Set<TSESTree.Node>,
): string | undefined {
    const variable = ASTUtils.findVariable(source.getScope(node), node);
    if (variable === null) return undefined;
    const definition = variable.defs[0];
    if (definition === undefined) return node.name;
    const imported = getImportedName(definition.node, source, seen);
    if (imported !== undefined) return imported;
    if (definition.node.type !== AST_NODE_TYPES.VariableDeclarator) return undefined;
    const value = getAssignedValue(variable);
    if (value === undefined) return undefined;
    const module = getModuleName(value, source, seen);
    return module === undefined || definition.node.id.type === AST_NODE_TYPES.Identifier
        ? module
        : getDestructuredName(definition.name, module);
}

function getMemberProperty(
    node: TSESTree.MemberExpression | TSESTree.TSQualifiedName,
    source: TSESLint.SourceCode,
): string | null {
    if (node.type === AST_NODE_TYPES.TSQualifiedName) return node.right.name;
    const property = ASTUtils.getPropertyName(node, source.getScope(node));
    if (property !== null) return property;
    return node.property.type === AST_NODE_TYPES.Identifier ? node.property.name : null;
}

function getMemberModule(
    node: TSESTree.MemberExpression | TSESTree.TSQualifiedName,
    source: TSESLint.SourceCode,
    seen: Set<TSESTree.Node>,
): string | undefined {
    const receiver = node.type === AST_NODE_TYPES.MemberExpression ? node.object : node.left;
    const module = getModuleName(receiver, source, seen);
    const property = getMemberProperty(node, source);
    return module === undefined || property === null ? undefined : `${module}.${property}`;
}

function getInnerModule(
    value: TSESTree.Node,
    source: TSESLint.SourceCode,
    seen: Set<TSESTree.Node>,
): string | undefined {
    if (value.type === AST_NODE_TYPES.TSExternalModuleReference) return value.expression.value;
    if (value.type === AST_NODE_TYPES.TaggedTemplateExpression) return getModuleName(value.tag, source, seen);
    return value.type === AST_NODE_TYPES.NewExpression ? getModuleName(value.callee, source, seen) : undefined;
}

/**
Find where a path sits inside a folder. Both take either separator and any drive letter case.
The folder `.` holds every relative path that does not climb out of it.

@param folder the folder, absolute or relative
@param path the file or folder to place
@returns the POSIX path below the folder, empty for the folder itself, or undefined outside it
*/
export function findPathInFolder(folder: string, path: string): string | undefined {
    const root = folder
        .replaceAll('\\', '/')
        .replace(DRIVE_LETTER, (drive) => drive.toUpperCase())
        .replace(TRAILING_SLASH, '');
    const file = path.replaceAll('\\', '/').replace(DRIVE_LETTER, (drive) => drive.toUpperCase());
    if (file === root) return '';
    if (root === '.') return file === '..' || file.startsWith('../') ? undefined : file;
    return file.startsWith(`${root}/`) ? file.slice(root.length + 1) : undefined;
}

/**
Resolve a binding only when one write supplies its value.

@param variable the binding whose initializer or assignment to follow.
*/
export function getAssignedValue(variable: TSESLint.Scope.Variable): TSESTree.Node | undefined {
    const writes = variable.references.filter((reference) => reference.isWrite());
    return writes.length === 1 ? (writes[0]?.writeExpr ?? undefined) : undefined;
}

/**
Follow imported, required, global, and aliased values to their qualified names. A call, a construction, and a
tagged template read the name of their callee.

@param node the referenced value.
@param source the current file and its scopes.
@param seen expressions already followed in this resolution.
*/
export function getModuleName(
    node: TSESTree.Node,
    source: TSESLint.SourceCode,
    seen = new Set<TSESTree.Node>(),
): string | undefined {
    const value = unwrapExpression(node);
    if (seen.has(value)) return undefined;
    seen.add(value);
    switch (value.type) {
        case AST_NODE_TYPES.Identifier: {
            return getBoundModule(value, source, seen);
        }
        case AST_NODE_TYPES.CallExpression: {
            return getCalledModule(value, source, seen);
        }
        case AST_NODE_TYPES.TSQualifiedName:
        case AST_NODE_TYPES.MemberExpression: {
            return getMemberModule(value, source, seen);
        }
        default: {
            return getInnerModule(value, source, seen);
        }
    }
}

/**
Name the imported or global value that an expression reads: the module path without a `node:` prefix and with its
slashes written as dots, then the members. After `import * as s3 from 'aws-cdk-lib/aws-s3'`,
`new s3.Bucket()` reads `aws-cdk-lib.aws-s3.Bucket`.

@param node the referenced value.
@param source the current file and its scopes.
@returns the dotted name, or undefined for a value that no import or global names.
*/
export function getQualifiedName(node: TSESTree.Node, source: TSESLint.SourceCode): string | undefined {
    const name = getModuleName(node, source);
    if (name === undefined) return undefined;
    return name.replace(NODE_PREFIX, '').split('/').join(MODULE_SEPARATOR);
}

/**
Get the first argument of a call to a module function as text, such as the algorithm of `crypto.createCipheriv`.

@param node a call such as `crypto.createCipheriv(algorithm, key, iv)`.
@param source the source code of the file.
@param name the qualified name of the function, as `getQualifiedName` writes it.
@returns the argument and its string value, or undefined for another function or an argument without a fixed string.
*/
export function getCallText(
    node: TSESTree.CallExpression,
    source: TSESLint.SourceCode,
    name: string,
): CallText | undefined {
    const [argument] = node.arguments;
    if (argument === undefined || getQualifiedName(node, source) !== name) return undefined;
    const value = ASTUtils.getStaticValue(argument, source.getScope(argument))?.value;
    return typeof value === 'string' ? { argument, text: value } : undefined;
}
