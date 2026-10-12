// Reads Python modules, declarations, and imports.
import type { Node } from 'web-tree-sitter';
import { readSource } from '#cli/system/file-reads.ts';
import { SURROUNDING_QUOTES } from '#cli/config/text.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { ParseCache, SourceInput } from '#cli/types/parsers/tree-sitter.ts';
import { PYTHON_EXTENSION, PYTHON_EXPORT_LIST, PYTHON_FUNCTION_NODES } from '#cli/config/parsers/python.ts';
import type { PythonFiles, PythonModule, PythonExports, PythonFunction } from '#cli/types/parsers/python.ts';

// The value assigned to __all__ by a statement, or undefined when the statement assigns something else.
function exportList(statement: Node): Node | undefined {
    const assignment = assignmentOf(statement);
    if (assignment?.childForFieldName('left')?.text !== PYTHON_EXPORT_LIST) return undefined;
    return assignment.childForFieldName('right') ?? undefined;
}

/**
 * Every function of a module, nested ones included.
 * @param module the module.
 * @returns the functions.
 */
function pythonFunctions(module: PythonModule): PythonFunction[] {
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
export function isDocstring(node: Node, siblings: Node[]): boolean {
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
export async function readPython(input: SourceInput): Promise<PythonFiles> {
    const modules: PythonModule[] = [];
    try {
        for (const file of input.files) {
            if (file.kind !== 'source' || !file.path.endsWith(PYTHON_EXTENSION)) continue;
            const text = readSource(input.root, file.path, input.reads).toString('utf8');
            modules.push(await parsePythonModule(file.path, text, input));
        }
        return { modules, functions: modules.flatMap((module) => pythonFunctions(module)) };
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
 * Read an assignment from an expression statement.
 * @param statement the module statement.
 * @returns the assignment, or undefined for other statements.
 */
export function assignmentOf(statement: Node): Node | undefined {
    const first = statement.type === 'expression_statement' ? statement.namedChildren[0] : undefined;
    return first?.type === 'assignment' ? first : undefined;
}

/**
 * The docstring text of a function, or undefined.
 * @param definition the function definition.
 * @returns the text inside the quotes.
 */
export function docstringOf(definition: Node): string | undefined {
    const siblings = definition.childForFieldName('body')?.namedChildren ?? [];
    const first = siblings.find((child) => child.type !== 'comment');
    if (first === undefined || !isDocstring(first, siblings)) return undefined;
    const content = first.namedChildren[0]?.namedChildren.find((part) => part.type === 'string_content');
    return content?.text.trim() ?? '';
}

/**
 * The names a module lists in __all__, or undefined when it has no such list.
 * @param module the module.
 * @returns the names and the statement that holds them.
 */
export function exportedNames(module: PythonModule): PythonExports | undefined {
    for (const statement of module.statements) {
        const list = exportList(statement);
        if (list === undefined) continue;
        const names = list.namedChildren
            .filter((item) => item.type === 'string')
            .map((item) => item.text.replaceAll(SURROUNDING_QUOTES, ''));
        return { names, statement };
    }
    return undefined;
}

/**
 * Release the trees held by parsed Python modules.
 * @param parsed the modules whose readers have finished.
 */
export function disposePython(parsed: PythonFiles): void {
    for (const source of parsed.modules) source.tree.delete();
}
