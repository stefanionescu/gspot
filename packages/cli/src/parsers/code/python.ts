import { type Node } from 'web-tree-sitter';

import { DOCSTRING_PREFIXES, PYTHON_EXTENSION, PYTHON_FUNCTION_NODES } from '#cli/config/parsers.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { remember } from '#cli/system/cache.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { ParseCache, PythonFiles, PythonFunction, PythonModule, SourceFiles } from '#cli/types/parsers.ts';

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
