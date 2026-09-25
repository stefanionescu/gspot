import { normalizePath } from '#plugin/files.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { posix } from 'node:path';

function aliasTarget(source: string, prefix: string, target: string): string | undefined {
    const clean = prefix.endsWith('*') ? prefix.slice(0, -1) : prefix;
    const bare = clean.endsWith('/') ? clean.slice(0, -1) : clean;
    if (source !== bare && !source.startsWith(clean)) return undefined;
    const rest = source.slice(clean.length);
    const base = target.endsWith('*') ? target.slice(0, -1) : target;
    return posix.join(base, rest);
}

/**
 * The file an import source names, relative imports against the importer and aliases against the root; undefined for packages.
 * @param importer the importing file
 * @param source the import source as written
 * @param root the repository root
 * @param aliases alias prefix to target directory, both optionally ending in `*`
 * @returns the file's path without an extension check, or undefined
 */
export function importFile(
    importer: string,
    source: string,
    root: string,
    aliases: Readonly<Record<string, string>> = {},
): string | undefined {
    if (source.startsWith('.')) {
        const joined = posix.join(posix.dirname(importer), source);
        return normalizePath(posix.normalize(joined));
    }
    for (const [prefix, target] of Object.entries(aliases)) {
        const aliased = aliasTarget(source, prefix, target);
        if (aliased !== undefined) return normalizePath(posix.normalize(posix.join(root, aliased)));
    }
    return undefined;
}

function isRequireCall(node: TSESTree.Node | null | undefined): boolean {
    return (
        node?.type === AST_NODE_TYPES.CallExpression &&
        node.callee.type === AST_NODE_TYPES.Identifier &&
        node.callee.name === 'require' &&
        node.arguments.length === 1
    );
}

/**
 * True for an import declaration or, when asked, a require statement.
 * @param node the statement
 * @param isRequireAllowed whether a top-level require counts as an import
 * @returns whether the statement belongs to the import block
 */
export function isImportLike(node: TSESTree.Statement, isRequireAllowed: boolean): boolean {
    if (node.type === AST_NODE_TYPES.ImportDeclaration) return true;
    if (!isRequireAllowed) return false;
    if (node.type === AST_NODE_TYPES.ExpressionStatement) return isRequireCall(node.expression);
    return (
        node.type === AST_NODE_TYPES.VariableDeclaration &&
        node.declarations.length === 1 &&
        isRequireCall(node.declarations[0].init)
    );
}
