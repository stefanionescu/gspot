import { posix } from 'node:path';
import type { TSESTree } from '@typescript-eslint/utils';
import { importFile, isRequireCall } from '#plugin/imports.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { ASTUtils, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { lintedFile, lintedRoot, staticString, isAnyGlobMatch, relativeToRoot } from '#plugin/files.ts';

import {
    NO_ROLES,
    ROLE_ORDER,
    TEST_ROLES,
    CONFIG_ROLES,
    CODE_EXTENSION,
    DEFAULT_CONTRACTS,
} from '#plugin/config/rules.ts';
import type {
    ImportEdge,
    ImportNode,
    ImportVerdict,
    ImportDirectionRole,
    ImportDirectionRoles,
    ImportDirectionOptions,
    ImportDirectionMessages,
} from '#plugin/types/rules.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The importer and the imported file get their role by the same glob lookup.
function roleOf(path: string, roles: Required<ImportDirectionRoles>): ImportDirectionRole {
    return ROLE_ORDER.find((role) => role !== 'other' && isAnyGlobMatch(path, roles[role])) ?? 'other';
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
    return { messageId: 'typesOnlyTypes', data: { source: edge.source, role: edge.targetRole } };
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
        type: 'problem',
        docs: {
            level: 'all',
            title: 'Import direction',
            example:
                'With the types role on `types/**`, the runtime role on `src/**`, and `@/` mapped to `src/`, a value import from `@/turn/build` inside `types/b.ts` reports `typesOnlyTypes`. For a type dependency, use `import type { A } from "@/turn/build";`. Keep runtime dependencies outside the type-only directory.',
            summary:
                'Checks the four import directions between the roles the options name: types import only types, runtime never imports tests, tests reach runtime only through contracts, and config never imports runtime.',
            why: 'An import against the direction makes a test part of the product, or a type file part of the runtime, and the build carries it.',
            fix: 'Import from the element contract (its index, public or contracts file) or from the types directory, or move the code to the layer that may import it.',
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
                contracts: { type: 'array', items: { type: 'string' } },
                scope: { type: 'string' },
            }),
        ],
        messages: {
            typesOnlyTypes:
                'A types file imports only types. "{{source}}" brings in {{role}} code; use import type or move the type.',
            runtimeToTests: 'Runtime code imports test code through "{{source}}". Move what it needs into the runtime.',
            testsToInternals:
                'Tests import runtime internals through "{{source}}". Import the element contract ({{contracts}}) or its types.',
            configToRuntime:
                'Configuration imports runtime code through "{{source}}". Configuration holds values; the runtime reads them.',
        },
    },
    defaultOptions: [{ roles: NO_ROLES, aliases: {}, contracts: DEFAULT_CONTRACTS, scope: '' }],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined) return {};
        const root = lintedRoot(context);
        const scope = (options.scope ?? '').replace(/\/$/u, '');
        const prefix = scope === '' ? '' : `${scope}/`;
        // eslint-disable-next-line gspot/no-trivial-functions -- reason: The importer and the import target are made relative to the scope the same way.
        const relativeOf = (absolute: string): string => {
            const rel = relativeToRoot(root, absolute);
            return prefix !== '' && rel.startsWith(prefix) ? rel.slice(prefix.length) : rel;
        };
        const roles: Required<ImportDirectionRoles> = { ...NO_ROLES, ...options.roles };
        const role = roleOf(relativeOf(file), roles);
        if (role === 'other') return {};
        const contracts = options.contracts ?? DEFAULT_CONTRACTS;
        const rootOfScope = scope === '' ? root : `${root}/${scope}`;
        const check = (node: TSESTree.Node, sourceNode: TSESTree.Node | null | undefined, typeOnly = false): void => {
            const source = staticString(sourceNode);
            const resolved =
                source === undefined ? undefined : importFile(file, source, rootOfScope, options.aliases ?? {});
            if (source === undefined || resolved === undefined) return;
            const target = relativeOf(resolved);
            const found = verdict(
                { role, targetRole: roleOf(target, roles), source, target, isTypeOnly: typeOnly },
                contracts,
            );
            if (found) context.report({ node, messageId: found.messageId, data: found.data });
        };
        return {
            ImportDeclaration(node) {
                check(node, node.source, isTypeOnly(node));
            },
            ExportAllDeclaration(node) {
                check(node, node.source, isTypeOnly(node));
            },
            ImportExpression(node) {
                check(node, node.source);
            },
            CallExpression(node) {
                if (!isRequireCall(node)) return;
                const variable = ASTUtils.findVariable(context.sourceCode.getScope(node), 'require');
                if (variable !== null && variable.defs.length > 0) return;
                check(node, node.arguments[0]);
            },
            ExportNamedDeclaration(node) {
                if (node.source) check(node, node.source, isTypeOnly(node));
            },
        };
    },
});
