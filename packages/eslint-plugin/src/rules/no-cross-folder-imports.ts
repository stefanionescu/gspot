import { posix } from 'node:path';
import type { TSESTree } from '@typescript-eslint/utils';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import type { CrossFolderImportsOptions } from '#plugin/types/rules.ts';
import { lintedFile, lintedRoot, staticString, normalizePath, relativeToRoot } from '#plugin/files.ts';

function aliasFor(target: string, aliases: Record<string, string>): string | undefined {
    for (const [prefix, directory] of Object.entries(aliases)) {
        const base = directory.replace(/\*$/u, '').replace(/\/$/u, '');
        if (target === base || target.startsWith(`${base}/`))
            return `${prefix.replace(/\*$/u, '')}${target.slice(base.length + 1)}`;
    }
    return undefined;
}

function topFolder(file: string, root: string): string | undefined {
    const prefix = root === '.' ? '' : `${root}/`;
    if (!file.startsWith(prefix)) return undefined;
    const path = file.slice(prefix.length);
    return path.includes('/') ? path.split('/', 1)[0] : undefined;
}

export const noCrossFolderImports = createRule<CrossFolderImportsOptions, 'cross' | 'crossNoAlias'>({
    name: 'no-cross-folder-imports',
    meta: {
        type: 'problem',
        fixable: 'code',
        docs: {
            level: 'all',
            title: 'Keep imports within folder boundaries',
            example:
                'With `@/` mapped to `src/`, `import { a } from "../turn/a.js";` in `src/other/b.ts` reports `cross`. Correct the import to `import { a } from "@/turn/a.js";`.',
            summary: 'Finds relative imports that leave their top-level folder under a source root.',
            why: 'A path of ../../ ties the importer to the tree shape; the alias names the folder and survives a move.',
            fix: 'Keep relative imports within a top-level folder. gspot check --fix uses a configured alias when one exists.',
        },
        schema: [
            optionsSchema({
                roots: { type: 'array', items: { type: 'string' } },
                aliases: { type: 'object', additionalProperties: { type: 'string' } },
            }),
        ],
        messages: {
            cross: 'Import "{{alias}}" instead of climbing folders with "{{source}}".',
            crossNoAlias: 'Relative import "{{source}}" leaves the "{{folder}}" folder.',
        },
    },
    defaultOptions: [{ roots: [], aliases: {} }],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined) return {};
        const root = lintedRoot(context);
        const relative = relativeToRoot(root, file);
        const roots = options.roots ?? [];
        const candidates =
            roots.length === 0 ? [relative.split('/', 1)[0] ?? ''] : roots.map((entry) => posix.normalize(entry));
        const sourceRoot = candidates
            .filter((entry) => entry === '.' || relative.startsWith(`${entry}/`))
            .toSorted((left, right) => right.length - left.length)[0];
        if (sourceRoot === undefined) return {};
        const folder = topFolder(relative, sourceRoot);
        if (folder === undefined) return {};
        const aliases = options.aliases ?? {};
        const check = (node: TSESTree.Node | null | undefined): void => {
            const source = staticString(node);
            if (source === undefined) return;
            if (!source.startsWith('./') && !source.startsWith('../')) return;
            const joinedPath = posix.join(posix.dirname(relative), source);
            const target = normalizePath(posix.normalize(joinedPath));
            if (topFolder(target, sourceRoot) === folder) return;
            const alias = aliasFor(target, aliases);
            const literal = node as TSESTree.Literal;
            const quote = literal.raw.startsWith('"') ? '"' : "'";
            if (alias === undefined) {
                context.report({ node: literal, messageId: 'crossNoAlias', data: { source, folder } });
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
