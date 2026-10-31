import { posix } from 'node:path';
import picomatch from 'picomatch';
import { createRule } from '../rule.ts';
import { buildSourceVisitors } from '../syntax.ts';
import { PLUGIN_PREFIX } from '../config/plugin.ts';
import { ASTUtils, AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { RelativeImport, ImportBoundariesOptions } from '../types/rules.ts';

import {
    DRIVE_LETTER,
    RESOURCE_QUERY,
    TRAILING_SLASH,
    RELATIVE_SPECIFIER,
    DEFAULT_BOUNDARY_FOLDERS,
    IMPORT_BOUNDARY_OPTIONS_SCHEMA,
} from '../config/rules.ts';

/**
Find where a path sits inside a folder. Both take either separator and any drive letter case.
The folder `.` holds every relative path that does not climb out of it.

@param folder the folder, absolute or relative
@param path the file or folder to place
@returns the POSIX path below the folder, empty for the folder itself, or undefined outside it
*/
function findPathInFolder(folder: string, path: string): string | undefined {
    const root = folder
        .replaceAll('\\', '/')
        .replace(DRIVE_LETTER, (drive) => drive.toUpperCase())
        .replace(TRAILING_SLASH, '');
    const file = path.replaceAll('\\', '/').replace(DRIVE_LETTER, (drive) => drive.toUpperCase());
    if (file === root) return '';
    if (root === '.') return file === '..' || file.startsWith('../') ? undefined : file;
    return file.startsWith(`${root}/`) ? file.slice(root.length + 1) : undefined;
}

function matchAlias(importedPath: string, pattern: string, target: string): string | undefined {
    const keyStar = pattern.indexOf('*');
    const targetStar = target.indexOf('*');
    if (keyStar === -1 || targetStar === -1)
        return keyStar === targetStar && importedPath === target ? pattern : undefined;
    const targetStart = target.slice(0, targetStar);
    const targetEnd = target.slice(targetStar + 1);
    const middleLength = importedPath.length - targetStart.length - targetEnd.length;
    if (middleLength < 0 || !importedPath.startsWith(targetStart) || !importedPath.endsWith(targetEnd))
        return undefined;
    const middle = importedPath.slice(targetStart.length, targetStart.length + middleLength);
    return `${pattern.slice(0, keyStar)}${middle}${pattern.slice(keyStar + 1)}`;
}

function findAlias(importedPath: string, aliases: Record<string, string>): string | undefined {
    for (const [pattern, target] of Object.entries(aliases)) {
        const alias = matchAlias(importedPath, pattern, posix.normalize(target));
        if (alias !== undefined) return alias;
    }
    return undefined;
}

function findEscapingImport(source: string, parentFolder: string, boundary: string): RelativeImport | undefined {
    if (!RELATIVE_SPECIFIER.test(source)) return undefined;
    const query = RESOURCE_QUERY.exec(source)?.[0] ?? '';
    const target = posix.join(parentFolder, source.slice(0, source.length - query.length));
    return findPathInFolder(boundary, target) === undefined ? { target, query } : undefined;
}

function findBoundary(parentFolder: string, isBoundary: (path: string) => boolean): string | undefined {
    if (findPathInFolder('.', parentFolder) === undefined) return undefined;
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
                'Finds relative imports that leave the nearest boundary folder: imports, re-exports, dynamic and type imports, import-equals declarations, and require calls. By default every second-level folder, such as `src/cart` or `packages/shop`, is a boundary. Set folders to project paths or folder globs to choose other boundaries. Paths and aliases are relative to `settings.gspot.root`, or to the working folder of ESLint.',
            why: 'Relative paths between folders couple separate parts of a project to the tree shape.',
            fix: 'Keep relative imports within the selected folder. eslint --fix uses a configured alias when one exists, and keeps a query such as `?raw`. Otherwise, move shared code into this folder or into a package both projects depend on, and import its package name.',
        },
        schema: [IMPORT_BOUNDARY_OPTIONS_SCHEMA],
        messages: {
            alias: 'Import "{{alias}}" instead of climbing folders with "{{source}}".',
            escape: 'Relative import "{{source}}" leaves the "{{folder}}" folder for "{{target}}". Import through an alias, or move the shared code into this folder.',
        },
    },
    create(context, [options]) {
        const relative = findPathInFolder(
            (context.settings[PLUGIN_PREFIX] as { root?: string } | undefined)?.root ?? context.cwd,
            context.physicalFilename,
        );
        if (relative === undefined) return {};
        const { folders, aliases, externals } = options;
        const isExternal = picomatch([...externals], { dot: true });
        const isBoundary = picomatch([...folders], { dot: true });
        const folder = findBoundary(posix.dirname(relative), isBoundary);
        if (folder === undefined) return {};
        return buildSourceVisitors((node) => {
            const source = ASTUtils.getStringIfConstant(node);
            const imported =
                source === null || isExternal(source)
                    ? undefined
                    : findEscapingImport(source, posix.dirname(relative), folder);
            if (source === null || imported === undefined) return;
            const { target, query } = imported;
            const alias = findAlias(target, aliases);
            if (alias === undefined) {
                context.report({
                    node,
                    messageId: 'escape',
                    data: { source, folder, target: findBoundary(posix.dirname(target), isBoundary) ?? target },
                });
                return;
            }
            context.report({
                node,
                messageId: 'alias',
                data: { alias: `${alias}${query}`, source },
                fix: (fixer) => {
                    if (node.type !== AST_NODE_TYPES.Literal) return null;
                    const quote = node.raw.charAt(0);
                    const text = `${alias}${query}`.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`);
                    return fixer.replaceText(node, `${quote}${text}${quote}`);
                },
            });
        });
    },
});
