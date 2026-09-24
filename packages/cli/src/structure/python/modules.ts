// The parsed Python modules of one run, and the functions they define.
import type { Node } from 'web-tree-sitter';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { readSource } from '#cli/repository/tracked.ts';
import type { EngineInput } from '#cli/types/execution.ts';
import type { PythonFunction, PythonModule } from '#cli/structure/python/types.ts';

function isDocstring(statement: Node | undefined): boolean {
    return statement?.type === 'expression_statement' && statement.namedChildren[0]?.type === 'string';
}

// The value assigned to __all__ by a statement, or undefined when the statement assigns something else.
function exportList(statement: Node): Node | undefined {
    const assignment = statement.type === 'expression_statement' ? statement.namedChildren[0] : undefined;
    if (assignment?.type !== 'assignment' || assignment.childForFieldName('left')?.text !== '__all__') return undefined;
    return assignment.childForFieldName('right') ?? undefined;
}

/**
 * Parses every claimed Python source file.
 * @param input the engine input
 * @returns the modules
 */
export async function pythonModules(input: EngineInput): Promise<PythonModule[]> {
    const modules: PythonModule[] = [];
    try {
        for (const file of input.files) {
            if (file.nature !== 'source' || !file.path.endsWith('.py')) continue;
            const text = readSource(input.root, file.path, input.observations).toString('utf8');
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
 * The statements of a function body without its docstring.
 * @param definition the function definition
 * @returns the statements
 */
export function bodyOf(definition: Node): Node[] {
    const statements = (definition.childForFieldName('body')?.namedChildren ?? []).filter(
        (child) => child.type !== 'comment',
    );
    return isDocstring(statements[0]) ? statements.slice(1) : statements;
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
        .map((node) => ({
            path: module.path,
            name: node.childForFieldName('name')?.text ?? '<anonymous>',
            node,
            body: bodyOf(node),
        }));
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
