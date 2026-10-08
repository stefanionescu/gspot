import { posix } from 'node:path';
import type { TSESTree } from '@typescript-eslint/utils';
import type { ImportSource } from '#plugin/types/imports.ts';
import { createRule, optionsSchema } from '#plugin/create-rule.ts';
import { ASTUtils, AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { ImportBoundariesOptions } from '#plugin/types/boundaries.ts';
import { lintedPath, isAnyGlobMatch, relativeImportPath } from '#plugin/public.ts';

function aliasFor(target: string, aliases: Record<string, string>): string | undefined {
    for (const [prefix, directory] of Object.entries(aliases)) {
        const base = directory.replace(/\*$/u, '').replace(/\/$/u, '');
        if (target === base || target.startsWith(`${base}/`))
            return `${prefix.replace(/\*$/u, '')}${target.slice(base.length + 1)}`;
    }
    return undefined;
}

function isWithinFolder(path: string, folder: string): boolean {
    if (folder === '.') return path !== '..' && !path.startsWith('../') && !posix.isAbsolute(path);
    return path === folder || path.startsWith(`${folder}/`);
}

// Match ancestors rather than import filenames: a boundary can contain files directly or deeper folders.
function boundaryOf(directory: string, folders: string[]): string | undefined {
    const segments = directory.split('/');
    const ancestors = segments.map((_segment, index) => segments.slice(0, index + 1).join('/'));
    if (isWithinFolder(directory, '.')) ancestors.unshift('.');
    return ancestors.findLast((ancestor) => isAnyGlobMatch(ancestor, folders));
}

export const importBoundaries = createRule<ImportBoundariesOptions, 'alias' | 'escape'>({
    name: 'import-boundaries',
    meta: {
        defaultOptions: [{ folders: ['*/*'], aliases: {} }],
        type: 'suggestion',
        fixable: 'code',
        docs: {
            level: 'all',
            title: 'Keep imports within folder boundaries',
            example:
                'With `@/` mapped to `src/`, `import { a } from "../turn/a.js";` in `src/other/b.ts` reports `alias`. Correct the import to `import { a } from "@/turn/a.js";`. With folders `api` and `supabase`, a relative import from `api` into `supabase` reports `escape`.',
            description:
                'Finds relative imports that leave the nearest boundary folder. The default `*/*` selects each top-level folder under each root, such as `src/turn` or `packages/shop`. Set folders to project paths or folder globs to choose other boundaries. Paths and aliases are relative to the repository root.',
            why: 'Relative paths between folders couple separate parts of a project to the tree shape.',
            fix: 'Keep relative imports within the selected folder. eslint --fix uses a configured alias when one exists. Otherwise, move shared code into this folder or into a package both projects depend on, and import its package name.',
        },
        schema: [
            optionsSchema({
                folders: {
                    description: 'Boundary folders or folder globs. The nearest matching ancestor owns each file.',
                    type: 'array',
                    items: { type: 'string' },
                },
                aliases: {
                    description: 'Import alias prefixes mapped to repository folders for fixes.',
                    type: 'object',
                    additionalProperties: { type: 'string' },
                },
            }),
        ],
        messages: {
            alias: 'Import "{{alias}}" instead of climbing folders with "{{source}}".',
            escape: 'Relative import "{{source}}" leaves the "{{folder}}" folder for "{{target}}". Import through an alias, or move the shared code into this folder.',
        },
    },
    create(context, [options]) {
        const file = lintedPath(context);
        if (file === undefined) return {};
        const { relative } = file;
        const { folders, aliases } = options;
        const folder = boundaryOf(posix.dirname(relative), folders);
        if (folder === undefined) return {};
        const check = (node: TSESTree.Node | null | undefined): void => {
            if (!node) return;
            const source = ASTUtils.getStringIfConstant(node);
            if (source === null) return;
            const target = relativeImportPath(relative, source);
            if (target === undefined) return;
            if (isWithinFolder(target, folder)) return;
            const alias = aliasFor(target, aliases);
            if (alias === undefined) {
                context.report({
                    node,
                    messageId: 'escape',
                    data: { source, folder, target: boundaryOf(posix.dirname(target), folders) ?? target },
                });
            } else {
                context.report({
                    node,
                    messageId: 'alias',
                    data: { alias, source },
                    fix:
                        node.type === AST_NODE_TYPES.Literal
                            ? (fixer) => fixer.replaceText(node, `${node.raw.charAt(0)}${alias}${node.raw.charAt(0)}`)
                            : null,
                });
            }
        };
        return {
            'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression'(node: ImportSource) {
                check(node.source);
            },
        };
    },
});
