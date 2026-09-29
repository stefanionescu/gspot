import type { Node } from 'web-tree-sitter';
import { readSource } from '#cli/repository/tracked.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { EngineInput, PythonModule, PythonFunction } from '#cli/types/checks.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two readers ask whether a statement is a docstring, and both callers sit at the complexity limit.
function isDocstring(statement: Node | undefined): boolean {
    return statement?.type === 'expression_statement' && statement.namedChildren[0]?.type === 'string';
}

// The value assigned to __all__ by a statement, or undefined when the statement assigns something else.
function exportList(statement: Node): Node | undefined {
    const assignment = assignmentOf(statement);
    if (assignment?.childForFieldName('left')?.text !== '__all__') return undefined;
    return assignment.childForFieldName('right') ?? undefined;
}

/**
 * Parses every owned Python source file.
 * @param input the engine input
 * @returns the modules
 */
export async function pythonModules(input: EngineInput): Promise<PythonModule[]> {
    const modules: PythonModule[] = [];
    try {
        for (const file of input.files) {
            if (file.kind !== 'source' || !file.path.endsWith('.py')) continue;
            const text = readSource(input.root, file.path, input.reads).toString('utf8');
            const tree = await parseSource('python', text, input);
            if (tree === null) throw new Error('The Python parser returned no tree.');
            const statements = tree.rootNode.namedChildren.filter((child) => child.type !== 'comment');
            modules.push({
                path: file.path,
                lines: text.split('\n'),
                tree,
                statements: statements.map((node) =>
                    node.type === 'decorated_definition' ? (node.childForFieldName('definition') ?? node) : node,
                ),
            });
        }
    } catch (error) {
        for (const source of modules) source.tree.delete();
        throw error;
    }
    return modules;
}

/**
 * Read an assignment from an expression statement.
 * @param statement the module statement
 * @returns the assignment, or undefined for other statements
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Read an assignment from an expression statement. 1 files make 1 calls; one owner keeps that behavior in one place.
export function assignmentOf(statement: Node): Node | undefined {
    const first = statement.type === 'expression_statement' ? statement.namedChildren[0] : undefined;
    return first?.type === 'assignment' ? first : undefined;
}

/**
 * The docstring text of a function, or undefined.
 * @param definition the function definition
 * @returns the text inside the quotes
 */
export function docstringOf(definition: Node): string | undefined {
    const first = (definition.childForFieldName('body')?.namedChildren ?? []).find((child) => child.type !== 'comment');
    if (!isDocstring(first)) return undefined;
    const content = first?.namedChildren[0]?.namedChildren.find((part) => part.type === 'string_content');
    return content?.text.trim() ?? '';
}

/**
 * Every function of a module, nested ones included.
 * @param module the module
 * @returns the functions
 */
export function functionsOf(module: PythonModule): PythonFunction[] {
    return module.tree.rootNode
        .descendantsOfType(['function_definition', 'lambda'])
        .filter((node) => node.isNamed)
        .map((node) => {
            const statements = (node.childForFieldName('body')?.namedChildren ?? []).filter(
                (child) => child.type !== 'comment',
            );
            return {
                path: module.path,
                name: node.childForFieldName('name')?.text ?? '<anonymous>',
                node,
                body: isDocstring(statements[0]) ? statements.slice(1) : statements,
            };
        });
}

/**
 * The names a module lists in __all__, or undefined when it has no such list.
 * @param module the module
 * @returns the names and the statement that holds them
 */
export function exportedNames(module: PythonModule): { names: string[]; statement: Node } | undefined {
    const statement = module.statements.find((entry) => exportList(entry) !== undefined);
    const list = statement === undefined ? undefined : exportList(statement);
    if (statement === undefined || list === undefined) return undefined;
    const names = list.namedChildren
        .filter((item) => item.type === 'string')
        .map((item) => item.text.replaceAll(/^["']|["']$/gu, ''));
    return { names, statement };
}
