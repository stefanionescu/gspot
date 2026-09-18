// A relative import that crosses a sibling top-level folder; use the alias.
import { posix } from 'node:path';
import { createRule } from '#plugin/rule.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { aliasMap, optionsSchema, stringList } from '#plugin/options.ts';
import type { CrossFolderImportsOptions } from '#plugin-types/options.ts';
import { lintedFile, lintedRoot, normalizePath, relativeToRoot, staticString } from '#plugin/files.ts';

function aliasFor(target: string, aliases: Record<string, string>): string | undefined {
    for (const [prefix, directory] of Object.entries(aliases)) {
        const base = directory.replace(/\*$/u, '').replace(/\/$/u, '');
        if (target === base || target.startsWith(`${base}/`))
            return `${prefix.replace(/\*$/u, '')}${target.slice(base.length + 1)}`;
    }
    return undefined;
}

export const noCrossFolderImports = createRule<CrossFolderImportsOptions, 'cross' | 'crossNoAlias'>({
    name: 'no-cross-folder-imports',
    meta: {
        type: 'problem',
        fixable: 'code',
        docs: {
            summary: 'Finds a relative import that climbs out of its folder into a sibling folder.',
            why: 'A path of ../../ ties the importer to the tree shape; the alias names the folder and survives a move.',
            fix: 'Import through the alias the rule names. gspot check --fix rewrites it when an alias exists.',
        },
        schema: [optionsSchema({ scope: stringList, aliases: aliasMap })],
        messages: {
            cross: 'Import "{{alias}}" instead of climbing folders with "{{source}}".',
            crossNoAlias: 'Do not climb folders with "{{source}}"; import through an alias.',
        },
    },
    defaultOptions: [{ scope: [], aliases: {} }],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined) return {};
        const root = lintedRoot(context);
        const relative = relativeToRoot(root, file);
        const scope = options.scope ?? [];
        if (scope.length > 0 && scope.every((segment) => !relative.split('/').slice(0, -1).includes(segment)))
            return {};
        const aliases = options.aliases ?? {};
        const check = (node: TSESTree.Node | null | undefined): void => {
            const source = staticString(node);
            if (source === undefined) return;
            if (!source.startsWith('../')) return;
            const joinedPath = posix.join(posix.dirname(relative), source);
            const target = normalizePath(posix.normalize(joinedPath));
            const alias = aliasFor(target, aliases);
            const literal = node as TSESTree.Literal;
            const quote = literal.raw.startsWith('"') ? '"' : "'";
            if (alias === undefined) {
                context.report({ node: literal, messageId: 'crossNoAlias', data: { source } });
            } else {
                context.report({
                    node: literal,
                    messageId: 'cross',
                    data: { alias, source },
                    fix: (fixer) => fixer.replaceText(literal, `${quote}${alias}${quote}`),
                });
            }
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
