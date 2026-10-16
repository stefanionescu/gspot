// Parses Python sources: functions, docstrings, and the names that read environment variables.
import { type Node } from 'web-tree-sitter';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import type { EnvironmentRead } from '#cli/types/parsers/environment.ts';
import type { ParseCache, SourceInput } from '#cli/types/parsers/tree-sitter.ts';
import { PYTHON_EXTENSION, PYTHON_FUNCTION_NODES } from '#cli/config/parsers/python.ts';
import type { PythonFiles, PythonModule, PythonFunction } from '#cli/types/parsers/python.ts';
import type { EnvironmentKind, EnvironmentNames, EnvironmentScope } from '#cli/types/checks/general.ts';

import {
    OS_MODULE,
    PYTHON_SCOPE_NODES,
    PYTHON_IMPORT_NODES,
    OS_ENVIRONMENT_MEMBERS,
} from '#cli/config/checks/general/structure.ts';

/**
 * Every function of a module, nested ones included.
 * @param module the parsed syntax tree and its repository-relative filename.
 * @returns declarations and lambdas with source nodes and executable body statements.
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

// Bindings inside a function or class belong to that lexical scope.
function findDeclarationScope(node: Node): Node {
    let scope = node.parent ?? node;
    while (scope.parent !== null && !PYTHON_SCOPE_NODES.has(scope.type)) scope = scope.parent;
    return scope;
}

// Import aliases retain the actual module or member identity.
function readImportName(node: Node) {
    if (node.type !== 'aliased_import') return { name: node.text, target: node.text };
    return { name: node.childForFieldName('alias')?.text, target: node.childForFieldName('name')?.text };
}

// Parameters declare names rather than the names used by their default expressions.
function listDeclaredNames(node: Node): string[] {
    if (node.type === 'parameters')
        return node.namedChildren.flatMap((parameter) => {
            const name =
                parameter.type === 'identifier'
                    ? parameter.text
                    : (parameter.childForFieldName('name')?.text ??
                      parameter.namedChildren.find((child) => child.type === 'identifier')?.text);
            return name === undefined ? [] : [name];
        });
    const declaration = node.childForFieldName('left') ?? node.childForFieldName('name');
    if (declaration === null) return [];
    return declaration.type === 'identifier'
        ? [declaration.text]
        : declaration.descendantsOfType('identifier').map((identifier) => identifier.text);
}

// Only os imports supply environment objects or getters.
function importNames(node: Node): EnvironmentScope {
    const entries: EnvironmentScope = new Map();
    let members: Record<string, EnvironmentKind> = {};
    if (node.type === 'import_statement') members = { [OS_MODULE]: OS_MODULE };
    else if (node.childForFieldName('module_name')?.text === OS_MODULE) members = OS_ENVIRONMENT_MEMBERS;
    for (const item of node.childrenForFieldName('name')) {
        const { name, target } = readImportName(item);
        if (name !== undefined && target !== undefined) entries.set(name, members[target]);
    }
    return entries;
}

// Calculate import identities and lexical declarations once for each source.
function collectPythonNames(root: Node): EnvironmentNames {
    const entries: EnvironmentNames = new Map();
    const nodes = [
        ...root.descendantsOfType([...PYTHON_IMPORT_NODES]),
        ...root.descendantsOfType([
            'assignment',
            'for_statement',
            'function_definition',
            'class_definition',
            'parameters',
        ]),
    ];
    for (const node of nodes) {
        const scope = findDeclarationScope(node).id;
        const names = entries.get(scope) ?? new Map<string, EnvironmentKind>();
        const declared = PYTHON_IMPORT_NODES.has(node.type)
            ? importNames(node)
            : new Map<string, EnvironmentKind>(listDeclaredNames(node).map((name) => [name, undefined]));
        for (const [name, kind] of declared) names.set(name, kind);
        entries.set(scope, names);
    }
    return entries;
}

// Resolve lexical imports before applying the environment read rule.
function findEnvironmentKind(node: Node, name: string, entries: EnvironmentNames): EnvironmentKind {
    for (
        let scope: Node | null = findDeclarationScope(node);
        scope !== null;
        scope = scope.parent === null ? null : findDeclarationScope(scope)
    ) {
        const names = entries.get(scope.id);
        if (names?.has(name) === true) return names.get(name);
    }
    return undefined;
}

// Reads name an object or call target, never the text inside a string.
function readReceiver(node: Node): Node | null {
    if (node.type === 'attribute') return node.childForFieldName('object');
    if (node.type === 'call') {
        const called = node.childForFieldName('function');
        return called?.type === 'attribute' ? called.childForFieldName('object') : (called ?? null);
    }
    return node;
}

// Find Python os environment objects and calls.
function isPythonEnvironmentRead(node: Node, entries: EnvironmentNames, environment: Set<number>): boolean {
    const receiver = readReceiver(node);
    if (receiver?.type !== 'identifier') return false;
    const kind = findEnvironmentKind(node, receiver.text, entries);
    if (kind === OS_MODULE) return environment.has(node.id);
    if (kind === 'getenv') return node.type === 'call';
    return kind === 'environ';
}

function isEnvironmentRead(
    node: Node,
    readers: readonly string[],
    entries: EnvironmentNames,
    environment: Set<number>,
): boolean {
    if (node.type === 'call' && readers.includes(node.childForFieldName('function')?.text ?? '')) return true;
    if (node.type === 'identifier' && node.parent?.type !== 'subscript') return false;
    return isPythonEnvironmentRead(node, entries, environment);
}

function expandEnvironmentExpression(node: Node): Node {
    const parent = node.parent;
    const expression =
        parent?.type === 'attribute' && parent.childForFieldName('attribute')?.text === 'get' ? parent : node;
    const container = expression.parent;
    return container !== null && (container.type === 'subscript' || container.type === 'call') ? container : expression;
}

function readEnvironmentLiteral(node: Node): Node | null | undefined {
    const expression = expandEnvironmentExpression(node);
    if (expression.type === 'subscript') return expression.childForFieldName('subscript');
    if (expression.type === 'call') return expression.childForFieldName('arguments')?.namedChildren[0];
    return undefined;
}

/**
 * Read Python environment access and configured reader calls through lexical import aliases.
 * @param syntaxRoot the parsed Python source.
 * @param readers the configured environment functions.
 * @returns the environment reads and their source positions.
 */
function readPythonEnvironment(syntaxRoot: Node, readers: readonly string[]): EnvironmentRead[] {
    const entries = collectPythonNames(syntaxRoot);
    const nodes = syntaxRoot.descendantsOfType(['attribute', 'call', 'identifier']);
    const environment = new Set(
        nodes
            .filter((node) =>
                node.type === 'attribute'
                    ? node.childForFieldName('attribute')?.text === 'environ'
                    : node.type === 'call' &&
                      node.childForFieldName('function')?.childForFieldName('attribute')?.text === 'getenv',
            )
            .map((node) => node.id),
    );
    return nodes.flatMap((node) => {
        if (!isEnvironmentRead(node, readers, entries, environment)) return [];
        const literal = readEnvironmentLiteral(node);
        const key =
            literal?.type === 'string'
                ? literal.namedChildren.find((child) => child.type === 'string_content')?.text
                : undefined;
        return [{ key, line: node.startPosition.row + 1, column: node.startPosition.column + 1 }];
    });
}

export { isDocstring, findDocstring, PYTHON_SOURCES, parsePythonModule, readPythonEnvironment };
