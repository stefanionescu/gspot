// A relative import that escapes the scope.
import { posix } from 'node:path';
import { createRule } from '#plugin/rules/definition.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { optionsSchema, stringList } from '#plugin/rules/options.ts';

import { lintedFile, lintedRoot, normalizePath, relativeToRoot, staticString } from '#plugin/files.ts';

export const noCrossProjectImports = createRule<CrossProjectImportsOptions, 'escape'>({
    name: 'no-cross-project-imports',
    meta: {
        type: 'problem',
        docs: {
            title: 'Keep imports within project boundaries',
            example:
                'With scopes `api` and `supabase`, an import of `../../supabase/src/a.js` from `api/src/b.ts` reports `escape`. Move shared behavior into a declared package dependency and import its package name. Relative imports within `api`, such as `../types/a.js`, remain in that scope.',
            summary: 'Finds a relative import that reaches out of its scope into another one.',
            why: 'Scopes are separate projects; a path between them couples two builds that were meant to stay apart.',
            fix: 'Move the shared code into a package both scopes depend on, or allow the escape with a reason.',
        },
        schema: [optionsSchema({ scopes: stringList, allowedEscapes: stringList })],
        messages: {
            escape: 'This import leaves the scope "{{scope}}" for "{{target}}". Each scope imports only from within itself.',
        },
    },
    defaultOptions: [{ scopes: [], allowedEscapes: [] }],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined) return {};
        const root = lintedRoot(context);
        const relative = relativeToRoot(root, file);
        const scopes = options.scopes ?? [];
        const scope = scopes.find((entry) => relative === entry || relative.startsWith(`${entry}/`));
        if (scope === undefined) return {};
        const escapes = options.allowedEscapes ?? [];
        const check = (node: TSESTree.Node | null | undefined): void => {
            const source = staticString(node);
            if (!node || source === undefined) return;
            if (!source.startsWith('.')) return;
            const joinedPath = posix.join(posix.dirname(relative), source);
            const target = normalizePath(posix.normalize(joinedPath));
            if (target === scope || target.startsWith(`${scope}/`)) return;
            if (
                escapes.some(
                    (escape) =>
                        target === escape.replace(/\/$/u, '') ||
                        target.startsWith(escape.endsWith('/') ? escape : `${escape}/`),
                )
            )
                return;
            context.report({
                node,
                messageId: 'escape',
                data: { scope, target: target.split('/', 1)[0] ?? target },
            });
        };
        return {
            ImportDeclaration: (node) => {
                check(node.source);
            },
            ExportAllDeclaration: (node) => {
                check(node.source);
            },
            ExportNamedDeclaration: (node) => {
                check(node.source);
            },
            ImportExpression: (node) => {
                check(node.source);
            },
        };
    },
});

export type CrossProjectImportsOptions = [{ scopes?: string[]; allowedEscapes?: string[] }];
