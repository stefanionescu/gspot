import { posix } from 'node:path';
import { isRequireCall } from '#plugin/imports.ts';
import { CODE_EXTENSION } from '#plugin/config/files.ts';
import { createRule, optionsSchema } from '#plugin/create-rule.ts';
import type { ImportNode, ImportSource } from '#plugin/types/imports.ts';
import { lintedPath, normalizePath, isAnyGlobMatch } from '#plugin/files.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { NO_ROLES, CONTRACTS, ROLE_ORDER, TEST_ROLES, CONFIG_ROLES } from '#plugin/config/import-direction.ts';

import type {
    ImportEdge,
    ImportVerdict,
    ImportLocation,
    ImportDirectionOptions,
    ImportDirectionMessages,
} from '#plugin/types/import-direction.ts';

function aliasTarget(source: string, prefix: string, target: string): string | undefined {
    const clean = prefix.endsWith('*') ? prefix.slice(0, -1) : prefix;
    const bare = clean.endsWith('/') ? clean.slice(0, -1) : clean;
    const matches = prefix.endsWith('*') ? source.startsWith(clean) : source === bare || source.startsWith(`${bare}/`);
    if (!matches) return undefined;
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
function importFile(
    importer: string,
    source: string,
    root: string,
    aliases: Readonly<Record<string, string>> = {},
): string | undefined {
    if (source.startsWith('.')) {
        const joined = posix.join(posix.dirname(importer), source);
        return normalizePath(posix.normalize(joined));
    }
    const candidates = Object.entries(aliases).toSorted(
        ([left], [right]) =>
            right.replace(/\*$/u, '').length - left.replace(/\*$/u, '').length ||
            Number(left.endsWith('*')) - Number(right.endsWith('*')),
    );
    for (const [prefix, target] of candidates) {
        const aliased = aliasTarget(source, prefix, target);
        if (aliased !== undefined) return normalizePath(posix.normalize(posix.join(root, aliased)));
    }
    return undefined;
}

function isTypeOnly(node: ImportNode): boolean {
    if ('importKind' in node && node.importKind === 'type') return true;
    if ('exportKind' in node && node.exportKind === 'type') return true;
    return (
        node.type === AST_NODE_TYPES.ImportDeclaration &&
        node.specifiers.length > 0 &&
        node.specifiers.every(
            (specifier) => specifier.type === AST_NODE_TYPES.ImportSpecifier && specifier.importKind === 'type',
        )
    );
}

function testsVerdict(edge: ImportEdge, contracts: string[]): ImportVerdict | undefined {
    const stem = posix.basename(edge.target).replace(CODE_EXTENSION, '');
    if (contracts.includes(stem)) return undefined;
    return { messageId: 'testsToInternals', data: { source: edge.source, contracts: contracts.join(', ') } };
}

function typesVerdict(edge: ImportEdge): ImportVerdict | undefined {
    if (edge.isTypeOnly || edge.targetRole === 'types') return undefined;
    return { messageId: 'typesToRuntime', data: { source: edge.source, target: edge.target } };
}

function verdict(edge: ImportEdge, contracts: string[]): ImportVerdict | undefined {
    const { role, targetRole, source } = edge;
    if (role === 'types') return typesVerdict(edge);
    if (role === 'runtime')
        return TEST_ROLES.has(targetRole) ? { messageId: 'runtimeToTests', data: { source } } : undefined;
    if (targetRole !== 'runtime' || edge.isTypeOnly) return undefined;
    if (TEST_ROLES.has(role)) return testsVerdict(edge, contracts);
    return CONFIG_ROLES.has(role) ? { messageId: 'configToRuntime', data: { source } } : undefined;
}

export const importDirection = createRule<ImportDirectionOptions, ImportDirectionMessages>({
    name: 'import-direction',
    meta: {
        defaultOptions: [{ roles: NO_ROLES, aliases: {}, scope: '' }],
        type: 'suggestion',
        docs: {
            level: 'all',
            title: 'Import direction',
            example:
                'With the types role on `types/**`, the runtime role on `src/**`, and `@/` mapped to `src/`, a value import from `@/turn/build` inside `types/b.ts` reports `typesToRuntime`. For a type dependency, use `import type { A } from "@/turn/build";`. Keep runtime dependencies outside the type-only directory.',
            description:
                'Checks the four import directions between the roles the options name: types import only types, runtime never imports tests, tests reach runtime only through contracts, and config never imports runtime.',
            why: 'An import against the direction makes a test part of the product, or a type file part of the runtime, and the build carries it.',
            fix: 'Import from the declared contract (its public or contracts file) or from the types directory, or move the code to the layer that may import it.',
        },
        schema: [
            optionsSchema({
                roles: optionsSchema({
                    types: { type: 'array', items: { type: 'string' } },
                    tests: { type: 'array', items: { type: 'string' } },
                    harness: { type: 'array', items: { type: 'string' } },
                    config: { type: 'array', items: { type: 'string' } },
                    env: { type: 'array', items: { type: 'string' } },
                    runtime: { type: 'array', items: { type: 'string' } },
                }),
                aliases: { type: 'object', additionalProperties: { type: 'string' } },
                scope: { type: 'string' },
            }),
        ],
        messages: {
            typesToRuntime:
                'A types file imports only types. "{{source}}" brings in "{{target}}"; use import type or move the type.',
            runtimeToTests: 'Runtime code imports test code through "{{source}}". Move what it needs into the runtime.',
            testsToInternals:
                'Tests import runtime internals through "{{source}}". Import the declared contract ({{contracts}}) or its types.',
            configToRuntime:
                'Configuration imports runtime code through "{{source}}". Configuration holds values; the runtime reads them.',
        },
    },
    create(context, [options]) {
        const file = lintedPath(context);
        if (file === undefined) return {};
        const { root } = file;
        const scope = options.scope.replace(/\/$/u, '');
        const prefix = scope === '' ? '' : `${scope}/`;
        const roles = options.roles;
        // Match roles at the repository root; diagnostics and aliases retain scope-relative paths.
        const placed = (absolute: string): ImportLocation => {
            const rel = absolute.startsWith(`${root}/`) ? absolute.slice(root.length + 1) : absolute;
            const path = prefix !== '' && rel.startsWith(prefix) ? rel.slice(prefix.length) : rel;
            const role = ROLE_ORDER.find((entry) => isAnyGlobMatch(rel, roles[entry])) ?? 'other';
            return { path, role };
        };
        const { role } = placed(file.absolute);
        if (role === 'other') return {};
        const contracts = CONTRACTS;
        const scopeRoot = scope === '' ? root : `${root}/${scope}`;
        const check = (node: TSESTree.Node, sourceNode: TSESTree.Node | null | undefined, typeOnly = false): void => {
            const source =
                sourceNode === null || sourceNode === undefined ? null : ASTUtils.getStringIfConstant(sourceNode);
            const resolved =
                source === null ? undefined : importFile(file.absolute, source, scopeRoot, options.aliases);
            if (source === null || resolved === undefined) return;
            const target = placed(resolved);
            const found = verdict(
                { role, targetRole: target.role, source, target: target.path, isTypeOnly: typeOnly },
                contracts,
            );
            if (found) context.report({ node, messageId: found.messageId, data: found.data });
        };
        return {
            'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression'(node: ImportSource) {
                check(node, node.source, node.type !== AST_NODE_TYPES.ImportExpression && isTypeOnly(node));
            },
            CallExpression(node) {
                if (!isRequireCall(node)) return;
                const variable = ASTUtils.findVariable(context.sourceCode.getScope(node), 'require');
                if (variable !== null && variable.defs.length > 0) return;
                check(node, node.arguments[0]);
            },
        };
    },
});
