import type { Node } from 'web-tree-sitter';
import { memo } from '#cli/platform/memo.ts';
import { readSource } from '#cli/platform/source.ts';
import { isDocstring } from '#cli/parsers/statements.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { ParseReads, SourceInput } from '#cli/types/parsers/source.ts';
import type { ParsedPython, PythonModule, PythonExports, PythonFunction } from '#cli/types/parsers/python.ts';

const MODULE_MEMO = { create: () => new WeakMap<DisposableStack, Map<string, Promise<ParsedPython>>>() };

async function readModules(input: SourceInput): Promise<ParsedPython> {
    const modules: PythonModule[] = [];
    try {
        for (const file of input.files) {
            if (file.kind !== 'source' || !file.path.endsWith('.py')) continue;
            const text = readSource(input.root, file.path, input.reads).toString('utf8');
            modules.push(await parsePythonModule(file.path, text, input));
        }
        return { modules, functions: modules.flatMap((module) => getPythonFunctions(module)) };
    } catch (error) {
        for (const module of modules) module.tree.delete();
        throw error;
    }
}

// The value assigned to __all__ by a statement, or undefined when the statement assigns something else.
function exportList(statement: Node): Node | undefined {
    const assignment = assignmentOf(statement);
    if (assignment?.childForFieldName('left')?.text !== '__all__') return undefined;
    return assignment.childForFieldName('right') ?? undefined;
}

/**
 * Parse one Python source module using the run's existing grammar cache when supplied.
 * @param path the repository-relative source path
 * @param text the exact source content
 * @param context the run-owned source reads and disposal owner
 * @returns a parsed module whose caller disposes its tree
 */
export async function parsePythonModule(path: string, text: string, context?: ParseReads): Promise<PythonModule> {
    const tree = await parseSource('python', text, context);
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
 * @param statement the module statement
 * @returns the assignment, or undefined for other statements
 */
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
    const siblings = definition.childForFieldName('body')?.namedChildren ?? [];
    const first = siblings.find((child) => child.type !== 'comment');
    if (first === undefined || !isDocstring(first, siblings)) return undefined;
    const content = first.namedChildren[0]?.namedChildren.find((part) => part.type === 'string_content');
    return content?.text.trim() ?? '';
}

/**
 * Every function of a module, nested ones included.
 * @param module the module
 * @returns the functions
 */
export function getPythonFunctions(module: PythonModule): PythonFunction[] {
    return module.tree.rootNode
        .descendantsOfType(['function_definition', 'lambda'])
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
 * The names a module lists in __all__, or undefined when it has no such list.
 * @param module the module
 * @returns the names and the statement that holds them
 */
export function exportedNames(module: PythonModule): PythonExports | undefined {
    for (const statement of module.statements) {
        const list = exportList(statement);
        if (list === undefined) continue;
        const names = list.namedChildren
            .filter((item) => item.type === 'string')
            .map((item) => item.text.replaceAll(/^["']|["']$/gu, ''));
        return { names, statement };
    }
    return undefined;
}

/**
 * Visit Python observations once per run, or dispose them when a standalone visit ends.
 * @param input the selected files, source reads, and optional run disposal owner
 * @param visit the reader that borrows the modules and functions
 * @returns the reader's result, after standalone trees have been disposed
 */
export async function visitPythonModules<Result>(
    input: SourceInput,
    visit: (parsed: ParsedPython) => Result | Promise<Result>,
): Promise<Result> {
    if (input.resources === undefined) {
        const parsed = await readModules(input);
        try {
            return await visit(parsed);
        } finally {
            for (const module of parsed.modules) module.tree.delete();
        }
    }
    const owners = memo(input.reads, MODULE_MEMO);
    let entries = owners.get(input.resources);
    if (entries === undefined) {
        entries = new Map();
        owners.set(input.resources, entries);
    }
    const key = JSON.stringify([input.root, input.files]);
    let pending = entries.get(key);
    if (pending === undefined) {
        pending = readModules(input);
        entries.set(key, pending);
        try {
            const parsed = await pending;
            input.resources.defer(() => {
                entries.delete(key);
                for (const module of parsed.modules) module.tree.delete();
            });
        } catch (error) {
            entries.delete(key);
            throw error;
        }
    }
    return visit(await pending);
}
