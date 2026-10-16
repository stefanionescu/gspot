// Reads Python modules, declarations, and imports.
// Reads Python modules, declarations, and imports.
import type { Node } from 'web-tree-sitter';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import type { ParseCache, SourceInput } from '#cli/types/parsers/tree-sitter.ts';
import { PYTHON_EXTENSION, PYTHON_FUNCTION_NODES } from '#cli/config/parsers/python.ts';
import type { PythonFiles, PythonModule, PythonFunction } from '#cli/types/parsers/python.ts';

/**
 * Every function of a module, nested ones included.
 * @param module the module.
 * @returns the functions.
 */
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
 * Whether this Python string expression starts the statements after any comments.
 * @param node the candidate statement.
 * @param siblings the statements in the same file or function body.
 * @returns whether the string expression supplies a docstring.
 */
function isDocstring(node: Node, siblings: Node[]): boolean {
    return (
        node.type === 'expression_statement' &&
        node.namedChildren[0]?.type === 'string' &&
        siblings.find((sibling) => !sibling.type.includes('comment'))?.equals(node) === true
    );
}

/**
 * Read selected Python sources and their function declarations.
 * @param input the selected files and source reads.
 * @returns parsed modules with trees to dispose of after use.
 */
async function readPython(input: SourceInput): Promise<PythonFiles> {
    const modules: PythonModule[] = [];
    try {
        for (const file of input.files) {
            if (file.kind !== 'source' || !file.path.endsWith(PYTHON_EXTENSION)) continue;
            const text = readCachedBytes(input.reads, file.path).toString('utf8');
            modules.push(await parsePythonModule(file.path, text, input));
        }
        return { modules, functions: modules.flatMap((module) => listFunctions(module)) };
    } catch (error) {
        for (const module of modules) module.tree.delete();
        throw error;
    }
}

/**
 * Parse one Python source module using the run's existing grammar cache when supplied.
 * @param path the repository-relative source path.
 * @param text the exact source content.
 * @param cache the source reads and tree cleanup for this run.
 * @returns a parsed module whose caller disposes its tree.
 */
async function parsePythonModule(path: string, text: string, cache?: ParseCache): Promise<PythonModule> {
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
 * The docstring text of a function, or undefined.
 * @param definition the function definition.
 * @returns the text inside the quotes.
 */
function findDocstring(definition: Node): string | undefined {
    const siblings = definition.childForFieldName('body')?.namedChildren ?? [];
    const first = siblings.find((child) => child.type !== 'comment');
    if (first === undefined || !isDocstring(first, siblings)) return undefined;
    const content = first.namedChildren[0]?.namedChildren.find((part) => part.type === 'string_content');
    return content?.text.trim() ?? '';
}

/**
 * Release the trees held by parsed Python modules.
 * @param parsed the modules whose readers have finished.
 */
function deletePythonTrees(parsed: PythonFiles): void {
    for (const source of parsed.modules) source.tree.delete();
}

/** Each run shares Python source trees through this reader identity. */
const PYTHON_SOURCES = { read: readPython, dispose: deletePythonTrees };

export { isDocstring, findDocstring, PYTHON_SOURCES, parsePythonModule };
