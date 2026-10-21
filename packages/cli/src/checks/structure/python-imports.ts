import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import type { ImportTarget, PythonSearch, LocatedImport } from '#cli/types/checks/structure.ts';

import {
    RELATIVE_IMPORT,
    PYTHON_FROM_STATEMENT,
    PYTHON_MODULE_SUFFIXES,
    PYTHON_IMPORT_STATEMENT,
} from '#cli/config/checks/structure.ts';

function findModuleFile(folder: string, dotted: string, files: ReadonlySet<string>): string | undefined {
    const base = posix.join(folder, ...dotted.split('.').filter((part) => part !== ''));
    return PYTHON_MODULE_SUFFIXES.map((suffix) => `${base}${suffix}`).find((path) => files.has(path));
}

function findAbsoluteModule(dotted: string, search: PythonSearch): string | undefined {
    for (const root of search.roots) {
        const found = findModuleFile(root, dotted, search.files);
        if (found !== undefined) return found;
    }
    return undefined;
}

function getImportedName(node: Node): string {
    return node.type === 'aliased_import' ? (node.childForFieldName('name')?.text ?? '') : node.text;
}

function findFirstModule(candidates: { module: string; target: string | undefined }[]): ImportTarget[] {
    const found = candidates.find((candidate) => candidate.target !== undefined);
    return found?.target === undefined ? [] : [{ module: found.module, target: found.target }];
}

function listImportedNames(node: Node): (string | undefined)[] {
    const names = node.childrenForFieldName('name').map((item) => getImportedName(item));
    return names.length === 0 ? [undefined] : names;
}

// from a.b import c loads the module a.b.c when it exists, and the module a.b otherwise.
function listAbsoluteTargets(node: Node, module: string, search: PythonSearch): LocatedImport[] {
    return listImportedNames(node).flatMap((name) => {
        const inner = name === undefined ? undefined : [module, name].join('.');
        return findFirstModule([
            ...(inner === undefined ? [] : [{ module: inner, target: findAbsoluteModule(inner, search) }]),
            { module, target: findAbsoluteModule(module, search) },
        ]).map((found) => ({ node, ...found }));
    });
}

// The module of a relative import as written: from .pkg import y names .pkg.y, and from . import y names .y.
function joinRelativeName(prefix: string, name: string | undefined): string {
    if (name === undefined) return prefix;
    return prefix.endsWith('.') ? prefix + name : [prefix, name].join('.');
}

// A relative import starts at the package of the file, and each dot after the first climbs one package.
function listRelativeTargets(node: Node, prefix: Node, file: string, search: PythonSearch): LocatedImport[] {
    const dots = prefix.namedChildren.find((child) => child.type === 'import_prefix')?.text.length ?? 1;
    const dotted = prefix.namedChildren.find((child) => child.type === 'dotted_name')?.text ?? '';
    const folder = posix.join(posix.dirname(file), ...Array.from({ length: dots - 1 }, () => '..'));
    return listImportedNames(node).flatMap((name) => {
        const inner = name === undefined ? undefined : [dotted, name].filter(Boolean).join('.');
        return findFirstModule([
            ...(inner === undefined
                ? []
                : [
                      {
                          module: joinRelativeName(prefix.text, name),
                          target: findModuleFile(folder, inner, search.files),
                      },
                  ]),
            { module: prefix.text, target: findModuleFile(folder, dotted, search.files) },
        ]).map((found) => ({ node, ...found }));
    });
}

/**
 * Find the repository files that the imports of one Python file load. Modules that the repository does not
 * hold, and the modules that python.externals names, have no target.
 *
 * @param root the syntax tree of the file.
 * @param file the repository-relative path of the file.
 * @param search the repository files, the folders of absolute imports, and the host modules.
 * @returns each import with the file it loads.
 */
export function listPythonImports(root: Node, file: string, search: PythonSearch): LocatedImport[] {
    return root.descendantsOfType([PYTHON_IMPORT_STATEMENT, PYTHON_FROM_STATEMENT]).flatMap((node) => {
        if (node.type === PYTHON_IMPORT_STATEMENT)
            return node.childrenForFieldName('name').flatMap((item) => {
                const module = getImportedName(item);
                const target = search.externals.has(module.split('.', 1)[0] ?? '')
                    ? undefined
                    : findAbsoluteModule(module, search);
                return target === undefined ? [] : [{ node, module, target }];
            });
        const source = node.childForFieldName('module_name');
        if (source === null) return [];
        if (source.type === RELATIVE_IMPORT) return listRelativeTargets(node, source, file, search);
        if (search.externals.has(source.text.split('.', 1)[0] ?? '')) return [];
        return listAbsoluteTargets(node, source.text, search);
    });
}
