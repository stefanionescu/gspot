import { posix } from 'node:path';
import picomatch from 'picomatch';
import { createRule } from '../create-rule.ts';
import { convertToPosixPath } from '../syntax.ts';
import { TRAILING_SLASH } from '../config/paths.ts';
import { PLUGIN_PREFIX } from '../config/plugin.ts';
import { IMPORT_SELECTOR } from '../config/syntax.ts';
import type { ImportSource } from '../types/syntax.ts';
import { QUERY, OPTIONS_SCHEMA } from '../config/rules/import-boundaries.ts';
import type { RuleContext, ImportBoundariesOptions } from '../types/rules.ts';
import { RELATIVE_PREFIXES, DEFAULT_BOUNDARY_FOLDERS } from '../config/imports.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getLintedPath(context: RuleContext): string | undefined {
    const absolute = convertToPosixPath(context.physicalFilename);
    const root = convertToPosixPath(
        (context.settings[PLUGIN_PREFIX] as { root?: string } | undefined)?.root ?? context.cwd,
    ).replace(TRAILING_SLASH, '');
    return absolute.startsWith(`${root}/`) ? absolute.slice(root.length + 1) : undefined;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function getImportedPath(importer: string, source: string): string | undefined {
    return RELATIVE_PREFIXES.every((prefix) => !source.startsWith(prefix))
        ? undefined
        : posix.join(posix.dirname(importer), source.replace(QUERY, ''));
}

function matchAlias(importedPath: string, pattern: string, target: string): string | undefined {
    const keyStar = pattern.indexOf('*');
    const targetStar = target.indexOf('*');
    if (keyStar === -1 || targetStar === -1) return importedPath === target ? pattern : undefined;
    const targetStart = target.slice(0, targetStar);
    const targetEnd = target.slice(targetStar + 1);
    return importedPath.startsWith(targetStart) && importedPath.endsWith(targetEnd)
        ? `${pattern.slice(0, keyStar)}${importedPath.slice(targetStart.length, importedPath.length - targetEnd.length)}${pattern.slice(keyStar + 1)}`
        : undefined;
}

function findAlias(importedPath: string, aliases: Record<string, string>): string | undefined {
    for (const [pattern, target] of Object.entries(aliases)) {
        const alias = matchAlias(importedPath, pattern, target);
        if (alias !== undefined) return alias;
    }
    return undefined;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function isWithinFolder(path: string, folder: string): boolean {
    return folder === '.' ? path !== '..' && !path.startsWith('../') : path === folder || path.startsWith(`${folder}/`);
}

function findBoundary(parentFolder: string, isBoundary: (path: string) => boolean): string | undefined {
    if (!isWithinFolder(parentFolder, '.')) return undefined;
    const segments = parentFolder.split('/');
    const ancestors = segments.map((_segment, index) => segments.slice(0, index + 1).join('/'));
    ancestors.unshift('.');
    return ancestors.findLast((ancestor) => isBoundary(ancestor));
}

export const importBoundaries = createRule<ImportBoundariesOptions, 'alias' | 'escape'>({
    name: 'import-boundaries',
    meta: {
        defaultOptions: [{ folders: DEFAULT_BOUNDARY_FOLDERS, aliases: {}, externals: [] }],
        type: 'suggestion',
        fixable: 'code',
        docs: {
            level: 'all',
            example:
                'With `@/*` mapped to `src/*`, `import { a } from "../turn/a.js";` in `src/other/b.ts` reports `alias`. Correct the import to `import { a } from "@/turn/a.js";`. With folders `api` and `supabase`, a relative import from `api` into `supabase` reports `escape`.',
            description:
                'Finds relative imports that leave the nearest boundary folder. By default every second-level folder, such as `src/cart` or `packages/shop`, is a boundary. Set folders to project paths or folder globs to choose other boundaries. Paths and aliases are relative to `settings.gspot.root`, or to the working folder of ESLint.',
            why: 'Relative paths between folders couple separate parts of a project to the tree shape.',
            fix: 'Keep relative imports within the selected folder. eslint --fix uses a configured alias when one exists. Otherwise, move shared code into this folder or into a package both projects depend on, and import its package name.',
        },
        schema: [OPTIONS_SCHEMA],
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
        const isBoundary = picomatch([...folders], { dot: true });
        const folder = findBoundary(posix.dirname(relative), isBoundary);
        if (folder === undefined) return {};
        const check = (node: TSESTree.Node | null): void => {
            if (node === null) return;
            const source = ASTUtils.getStringIfConstant(node);
            if (source === null || isExternal(source)) return;
            const target = getImportedPath(relative, source);
            if (target === undefined || isWithinFolder(target, folder)) return;
            const alias = findAlias(target, aliases);
            if (alias === undefined) {
                context.report({
                    node,
                    messageId: 'escape',
                    data: { source, folder, target: findBoundary(posix.dirname(target), isBoundary) ?? target },
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
            // eslint-disable-next-line gspot/no-trivial-functions -- reason: ESLint calls it for each matching node.
            [IMPORT_SELECTOR](node: ImportSource) {
                check(node.source);
            },
        };
    },
});
