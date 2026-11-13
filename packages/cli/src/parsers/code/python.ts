import { posix } from 'node:path';

import type { Node } from 'web-tree-sitter';

import {
    DOCSTRING_PREFIXES,
    PYTHON_EXTENSION,
    PYTHON_FROM_STATEMENT,
    PYTHON_FUNCTION_NODES,
    PYTHON_IMPORT_STATEMENT,
    PYTHON_MODULE_SUFFIXES,
    RELATIVE_IMPORT,
} from '#cli/config/parsers/code.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { remember } from '#cli/system/cache.ts';
import { readText } from '#cli/system/files/reads.ts';
import type {
    LocatedImport,
    ParseCache,
    PythonFiles,
    PythonFunction,
    PythonModule,
    PythonSearch,
    SourceFiles,
} from '#cli/types/parsers.ts';

function listFunctions(module: PythonModule): PythonFunction[] {
    return module.tree.rootNode
        .descendantsOfType([...PYTHON_FUNCTION_NODES])
        .filter((node) => node.isNamed)
        .map((node) => {
            const statements = node.childForFieldName('body')?.namedChildren ?? [];
            return {
                path: module.path,
                name: node.childForFieldName('name')?.text ?? 'lambda',
                node,
                body: statements.filter((child) => child.type !== 'comment' && !isDocstring(child, statements)),
            };
        });
}

function findModuleFile(folder: string, dotted: string, files: ReadonlySet<string>): string | undefined {
    const base = posix.join(folder, ...dotted.split('.').filter((segment) => segment !== ''));
    return PYTHON_MODULE_SUFFIXES.map((suffix) => `${base}${suffix}`).find((path) => files.has(path));
}

function findAbsoluteModule(dotted: string, search: PythonSearch): string | undefined {
    for (const root of search.roots) {
        const found = findModuleFile(root, dotted, search.files);
        if (found !== undefined) return found;
    }
    return undefined;
}

function listImportedNames(node: Node): Array<string | undefined> {
    const names = node
        .childrenForFieldName('name')
        .map((nameNode) =>
            nameNode.type === 'aliased_import' ? (nameNode.childForFieldName('name')?.text ?? '') : nameNode.text,
        );
    return names.length === 0 ? [undefined] : names;
}

function listAbsoluteImports(node: Node, module: string, search: PythonSearch): LocatedImport[] {
    return listImportedNames(node).flatMap((name) => {
        if (name !== undefined) {
            const inner = [module, name].join('.');
            const innerPath = findAbsoluteModule(inner, search);
            if (innerPath !== undefined) return [{ node, module: inner, path: innerPath }];
        }
        const path = findAbsoluteModule(module, search);
        return path === undefined ? [] : [{ node, module, path }];
    });
}

function listRelativeImports(node: Node, prefix: Node, file: string, search: PythonSearch): LocatedImport[] {
    const dots = prefix.namedChildren.find((child) => child.type === 'import_prefix')?.text.length ?? 1;
    const dotted = prefix.namedChildren.find((child) => child.type === 'dotted_name')?.text ?? '';
    const folder = posix.join(posix.dirname(file), ...Array.from({ length: dots - 1 }, () => '..'));
    const packagePath = findModuleFile(folder, dotted, search.files);
    const packageImports = packagePath === undefined ? [] : [{ node, module: prefix.text, path: packagePath }];
    return listImportedNames(node).flatMap((name) => {
        if (name === undefined) return packageImports;
        const innerPath = findModuleFile(folder, [dotted, name].filter(Boolean).join('.'), search.files);
        if (innerPath === undefined) return packageImports;
        const module = prefix.text.endsWith('.') ? prefix.text + name : [prefix.text, name].join('.');
        return [{ node, module, path: innerPath }];
    });
}

function listModuleImports(node: Node, search: PythonSearch): LocatedImport[] {
    return listImportedNames(node).flatMap((module) => {
        if (module === undefined || search.externals.has(module.split('.', 1)[0] ?? '')) return [];
        const path = findAbsoluteModule(module, search);
        return path === undefined ? [] : [{ node, module, path }];
    });
}

function listFromImports(node: Node, file: string, search: PythonSearch): LocatedImport[] {
    const source = node.childForFieldName('module_name');
    if (source === null) return [];
    if (source.type === RELATIVE_IMPORT) return listRelativeImports(node, source, file, search);
    return search.externals.has(source.text.split('.', 1)[0] ?? '')
        ? []
        : listAbsoluteImports(node, source.text, search);
}

export function isDocstring(node: Node, siblings: Node[]): boolean {
    const literal = node.namedChildren[0];
    if (literal !== undefined && DOCSTRING_PREFIXES.test(literal.text)) return false;
    return (
        node.type === 'expression_statement' &&
        node.namedChildren[0]?.type === 'string' &&
        siblings.find((sibling) => !sibling.type.includes('comment'))?.equals(node) === true
    );
}

const PYTHON_FILES = Symbol('python files');

export function readPythonFiles(sources: SourceFiles): Promise<PythonFiles> {
    return remember(sources.cache, PYTHON_FILES, JSON.stringify(sources.files.map((file) => file.path)), async () => {
        const modules: PythonModule[] = [];
        for (const file of sources.files) {
            if (file.kind !== 'source' || !file.path.endsWith(PYTHON_EXTENSION)) continue;
            const module = await parsePythonModule(file.path, readText(sources.cache, file.path), sources);
            sources.resources.push(module.tree);
            modules.push(module);
        }
        return { modules, functions: modules.flatMap((module) => listFunctions(module)) };
    });
}

export async function parsePythonModule(path: string, text: string, cache: ParseCache): Promise<PythonModule> {
    const tree = await parseSource('python', text, cache);
    const statements = tree.rootNode.namedChildren.filter((child) => child.type !== 'comment');
    return {
        path,
        lines: text.split('\n'),
        tree,
        statements: statements.map((node) =>
            node.type === 'decorated_definition' ? (node.childForFieldName('definition') ?? node) : node,
        ),
    };
}

export function findDocstring(definition: Node): string | undefined {
    const siblings = definition.childForFieldName('body')?.namedChildren ?? [];
    const first = siblings.find((child) => child.type !== 'comment');
    if (first === undefined || !isDocstring(first, siblings)) return undefined;
    const content = first.namedChildren[0]?.namedChildren.find((child) => child.type === 'string_content');
    return content?.text.trim() ?? '';
}

export function listPythonImports(syntaxRoot: Node, file: string, search: PythonSearch): LocatedImport[] {
    const statements = syntaxRoot.descendantsOfType([PYTHON_IMPORT_STATEMENT, PYTHON_FROM_STATEMENT]);
    return statements.flatMap((node) =>
        node.type === PYTHON_IMPORT_STATEMENT ? listModuleImports(node, search) : listFromImports(node, file, search),
    );
}
