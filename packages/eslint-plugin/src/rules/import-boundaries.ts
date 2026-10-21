import { posix } from 'node:path';
import picomatch from 'picomatch';
import { PLUGIN_PREFIX } from '../config/plugin.ts';
import { IMPORT_SELECTOR } from '../config/syntax.ts';
import type { ImportSource } from '../types/syntax.ts';
import { createRule } from '../schemas/rules/options.ts';
import { DEFAULT_FOLDERS, RELATIVE_PREFIXES } from '../config/imports.ts';
import type { RuleContext, ImportBoundariesOptions } from '../types/rules.ts';
import { STDIN_NAMES, TRAILING_STAR, TRAILING_SLASH } from '../config/paths.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { importBoundariesOptionsSchema } from '../schemas/rules/import-boundaries.ts';

const globCache = new Map<string, (path: string) => boolean>();
function isGlobMatch(path: string, glob: string): boolean {
    let isMatch = globCache.get(glob);
    if (isMatch === undefined) {
        isMatch = picomatch(glob, { dot: true });
        globCache.set(glob, isMatch);
    }
    return isMatch(path);
}

function getLintedPath(context: RuleContext): string | undefined {
    const absolute = context.physicalFilename.replaceAll('\\', '/').replace(/^[a-z]:/u, (drive) => drive.toUpperCase());
    if (STDIN_NAMES.has(absolute)) return undefined;
    const root = ((context.settings[PLUGIN_PREFIX] as { root?: string } | undefined)?.root ?? context.cwd)
        .replaceAll('\\', '/')
        .replace(/^[a-z]:/u, (drive) => drive.toUpperCase())
        .replace(TRAILING_SLASH, '');
    return absolute.startsWith(`${root}/`) ? absolute.slice(root.length + 1) : undefined;
}

function computeImportTarget(importer: string, source: string): string | undefined {
    if (!RELATIVE_PREFIXES.some((prefix) => source.startsWith(prefix))) return undefined;
    return posix.join(posix.dirname(importer), source.split('?', 1)[0] ?? source);
}

function findAlias(target: string, aliases: Record<string, string>): string | undefined {
    for (const [prefix, folder] of Object.entries(aliases)) {
        const base = folder.replace(TRAILING_STAR, '').replace(TRAILING_SLASH, '');
        if (target === base || target.startsWith(`${base}/`))
            return `${prefix.replace(TRAILING_STAR, '')}${target.slice(base.length + 1)}`;
    }
    return undefined;
}

function isWithinFolder(path: string, folder: string): boolean {
    if (folder === '.') return path !== '..' && !path.startsWith('../');
    return path === folder || path.startsWith(`${folder}/`);
}

// Match ancestors rather than import filenames: a boundary can contain files directly or deeper folders.
function findBoundary(parentFolder: string, folders: readonly string[]): string | undefined {
    if (!isWithinFolder(parentFolder, '.')) return undefined;
    const segments = parentFolder.split('/');
    const ancestors = segments.map((_segment, index) => segments.slice(0, index + 1).join('/'));
    ancestors.unshift('.');
    return ancestors.findLast((ancestor) => folders.some((glob) => isGlobMatch(ancestor, glob)));
}

export const importBoundaries = createRule<ImportBoundariesOptions, 'alias' | 'escape'>({
    name: 'import-boundaries',
    meta: {
        defaultOptions: [{ folders: DEFAULT_FOLDERS, aliases: {}, externals: [] }],
        type: 'suggestion',
        fixable: 'code',
        docs: {
            level: 'all',
            example:
                'With `@/` mapped to `src/`, `import { a } from "../turn/a.js";` in `src/other/b.ts` reports `alias`. Correct the import to `import { a } from "@/turn/a.js";`. With folders `api` and `supabase`, a relative import from `api` into `supabase` reports `escape`.',
            description:
                'Finds relative imports that leave the nearest boundary folder. By default every second-level folder, such as `src/cart` or `packages/shop`, is a boundary. Set folders to project paths or folder globs to choose other boundaries. Paths and aliases are relative to the repository root. Alias imports are out of scope; architecture modules govern them.',
            why: 'Relative paths between folders couple separate parts of a project to the tree shape.',
            fix: 'Keep relative imports within the selected folder. eslint --fix uses a configured alias when one exists. Otherwise, move shared code into this folder or into a package both projects depend on, and import its package name.',
        },
        schema: [importBoundariesOptionsSchema],
        messages: {
            alias: 'Import "{{alias}}" instead of climbing folders with "{{source}}".',
            escape: 'Relative import "{{source}}" leaves the "{{folder}}" folder for "{{target}}". Import through an alias, or move the shared code into this folder.',
        },
    },
    create(context, [options]) {
        const relative = getLintedPath(context);
        if (relative === undefined) return {};
        const { folders, aliases, externals } = options;
        const isExternal = picomatch([...externals], { dot: true });
        const folder = findBoundary(posix.dirname(relative), folders);
        if (folder === undefined) return {};
        const check = (node: TSESTree.Node | null): void => {
            if (node === null) return;
            const source = ASTUtils.getStringIfConstant(node);
            if (source === null || isExternal(source)) return;
            const target = computeImportTarget(relative, source);
            if (target === undefined) return;
            if (isWithinFolder(target, folder)) return;
            const alias = findAlias(target, aliases);
            if (alias === undefined) {
                context.report({
                    node,
                    messageId: 'escape',
                    data: { source, folder, target: findBoundary(posix.dirname(target), folders) ?? target },
                });
            } else {
                context.report({
                    node,
                    messageId: 'alias',
                    data: { alias, source },
                    fix: (fixer) =>
                        node.type === AST_NODE_TYPES.Literal
                            ? fixer.replaceText(node, `${node.raw.charAt(0)}${alias}${node.raw.charAt(0)}`)
                            : null,
                });
            }
        };
        return {
            [IMPORT_SELECTOR](node: ImportSource) {
                check(node.source);
            },
        };
    },
});
