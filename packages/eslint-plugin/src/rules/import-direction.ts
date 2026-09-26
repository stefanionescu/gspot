import { posix } from 'node:path';
import { importFile } from '#plugin/imports.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { lintedFile, lintedRoot, isAnyGlobMatch, relativeToRoot, staticString } from '#plugin/files.ts';

import {
    CODE_EXTENSION,
    CONFIG_ROLES,
    DEFAULT_CONTRACTS,
    DEFAULT_ROLES,
    ROLE_ORDER,
    TEST_ROLES,
} from '#plugin/constants/rules.ts';
import type {
    ImportDirectionMessages,
    ImportDirectionOptions,
    ImportDirectionRole,
    ImportDirectionRoles,
    ImportEdge,
    ImportNode,
    ImportVerdict,
} from '#plugin/types/rules.ts';

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
            title: 'Import direction',
            example:
                'With `@/` mapped to `src/`, a value import from `@/turn/build` inside `types/b.ts` reports `typesOnlyTypes`. For a type dependency, use `import type { A } from "@/turn/build";`. Keep runtime dependencies outside the type-only directory.',
            summary:
                'Checks the four import directions: types import only types, runtime never imports tests, tests reach runtime only through contracts, and config never imports runtime.',
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
    defaultOptions: [{ roles: DEFAULT_ROLES, aliases: {}, contracts: DEFAULT_CONTRACTS, scope: '' }],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined) return {};
        const root = lintedRoot(context);
        const scope = (options.scope ?? '').replace(/\/$/u, '');
        const prefix = scope === '' ? '' : `${scope}/`;
        const relativeOf = (absolute: string): string => {
            const rel = relativeToRoot(root, absolute);
            return prefix !== '' && rel.startsWith(prefix) ? rel.slice(prefix.length) : rel;
        };
        const roles: Required<ImportDirectionRoles> = { ...DEFAULT_ROLES, ...options.roles };
        const role = roleOf(relativeOf(file), roles);
        if (role === 'other') return {};
        const contracts = options.contracts ?? DEFAULT_CONTRACTS;
        const rootOfScope = scope === '' ? root : `${root}/${scope}`;
        const check = (node: ImportNode): void => {
            const source = staticString(node.source);
            const resolved =
                source === undefined ? undefined : importFile(file, source, rootOfScope, options.aliases ?? {});
            if (source === undefined || resolved === undefined) return;
            const target = relativeOf(resolved);
            const found = verdict(
                { role, targetRole: roleOf(target, roles), source, target, isTypeOnly: isTypeOnly(node) },
                contracts,
            );
            if (found) context.report({ node, messageId: found.messageId, data: found.data });
        };
        return {
            ImportDeclaration: check,
            ExportAllDeclaration: check,
            ExportNamedDeclaration(node) {
                if (node.source) check(node);
            },
        };
    },
});
