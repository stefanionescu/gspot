import { type Node } from 'web-tree-sitter';
import { read } from '#cli/system/files/reads.ts';
import { remember } from '#cli/system/files/cache.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { type ParseCache } from '#cli/types/parsers/code/grammars.ts';
import { PYTHON_EXTENSION, DOCSTRING_PREFIXES, PYTHON_FUNCTION_NODES } from '#cli/config/parsers/code/python.ts';

import {
    type SourceFiles,
    type PythonFiles,
    type PythonModule,
    type PythonFunction,
} from '#cli/types/parsers/code/python.ts';

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

/**
Check whether a Python string expression comes first, after any comments.

@param node the statement to test.
@param siblings the statements in the same file or function body.
*/
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

/**
Parse the Python sources once for each list of paths, and free their trees with the run.

@param sources the files, the run cache, and the run resources.
@returns the modules and their functions.
*/
export function readPythonFiles(sources: SourceFiles): Promise<PythonFiles> {
    return remember(sources.reads, PYTHON_FILES, JSON.stringify(sources.files.map((file) => file.path)), async () => {
        const modules: PythonModule[] = [];
        for (const file of sources.files) {
            if (file.kind !== 'source' || !file.path.endsWith(PYTHON_EXTENSION)) continue;
            const module = await parsePythonModule(file.path, read(sources.reads, file.path), sources);
            sources.resources.defer(() => {
                module.tree.delete();
            });
            modules.push(module);
        }
        return { modules, functions: modules.flatMap((module) => listFunctions(module)) };
    });
}

/**
Parse one Python module with the grammar cache of the run.

@param path the repository-relative source file.
@param text the exact source content.
@param cache the source reads and tree cleanup for this run.
@returns the caller disposes its tree.
*/
export async function parsePythonModule(path: string, text: string, cache?: ParseCache): Promise<PythonModule> {
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

/**
Find the docstring text of a function.

@param definition the function node.
*/
export function findDocstring(definition: Node): string | undefined {
    const siblings = definition.childForFieldName('body')?.namedChildren ?? [];
    const first = siblings.find((child) => child.type !== 'comment');
    if (first === undefined || !isDocstring(first, siblings)) return undefined;
    const content = first.namedChildren[0]?.namedChildren.find((child) => child.type === 'string_content');
    return content?.text.trim() ?? '';
}
