import ts from 'typescript';
import type { Node } from 'web-tree-sitter';
import { readSource } from '#cli/platform/root/public.ts';
import { parseSource } from '#cli/parsers/source/public.ts';
import type { TypescriptImports } from '#cli/types/parsers/typescript.ts';
import type { ParseReads, SourceInput } from '#cli/types/parsers/source.ts';
import type { IsSubstantial, CountedLanguage } from '#cli/types/parsers/statements.ts';
import type { ParsedPython, PythonModule, PythonExports, PythonFunction } from '#cli/types/parsers/python.ts';

import {
    NAMES,
    TYPE_ALIASES,
    CONTAINER_NODES,
    CONTAINER_NOISE,
    TYPE_REFERENCES,
    COUNTED_FUNCTION_NODES,
} from '#cli/config/parsers/statements.ts';

// Whether a Bash node is one executable command or statement.
function isBashStatement(node: Node): boolean {
    if (node.type === 'command' || node.type === 'declaration_command') return true;
    if (node.type === 'variable_assignment')
        return node.parent?.type !== 'declaration_command' && node.parent?.type !== 'command';
    return node.type.endsWith('_statement') && node.type !== 'compound_statement';
}

// How many executable statements one node counts as in each language, before its children are counted.
const STATEMENT_COUNTS: Record<CountedLanguage, (node: Node) => number> = {
    swift: (node) => (node.parent?.type === 'statements' ? 1 : 0),
    python: (node) => {
        const isClass = node.type === 'class_definition';
        const isStatement = node.type.endsWith('_statement') && node.type !== 'decorated_definition';
        return Number(isClass) + Number(isStatement);
    },
    bash: (node) => (isBashStatement(node) ? 1 : 0),
};

// Whether a function holds more executable statements than the trivial threshold, ignoring a Python docstring.
function isSubstantialFunction(node: Node, language: CountedLanguage, threshold: number): boolean {
    if (node.type === 'lambda') return false;
    if (node.type === 'computed_property' && !node.namedChildren.some((child) => child.type === 'statements'))
        return node.namedChildren.some((child) => isSubstantial(child, language, threshold));
    const body = node.childForFieldName('body') ?? node;
    const siblings = body.namedChildren;
    const children = siblings.filter((child) => !(language === 'python' && isDocstring(child, siblings)));
    return executableStatements(children, language) > threshold;
}

// Whether an assignment does more than forward a name: it declares a type, or its value is substantial.
function isSubstantialAssignment(node: Node, language: CountedLanguage, threshold: number): boolean {
    if (node.childForFieldName('left')?.text === '__all__') return false;
    const value = node.childForFieldName('right');
    return node.childForFieldName('type') !== null || (value !== null && isSubstantial(value, language, threshold));
}

// An alias is substantial when its value does more than name an existing type.
function isNonReferenceAlias(node: Node): boolean {
    const value = node.childForFieldName('value') ?? node.namedChildren.at(-1);
    return value !== undefined && !TYPE_REFERENCES.has(value.type);
}

// What each kind of node must hold to count as substantial, by node type.
const SUBSTANCE: Record<string, IsSubstantial> = {
    expression_statement: (node, language, threshold) => {
        const child = node.namedChildren[0];
        return child !== undefined && child.type !== 'string' && isSubstantial(child, language, threshold);
    },
    assignment: isSubstantialAssignment,
    property_declaration: (node, language, threshold) => {
        const computed = node.childForFieldName('computed_value');
        return computed === null || isSubstantial(computed, language, threshold);
    },
    type_alias_statement: isNonReferenceAlias,
    typealias_declaration: isNonReferenceAlias,
};

// The node kinds one language reads differently from the others.
const LANGUAGE_SUBSTANCE: Record<CountedLanguage, Record<string, IsSubstantial>> = {
    bash: {
        command: (node: Node): boolean => {
            const name = node.childForFieldName('name')?.text;
            return name !== 'source' && name !== '.';
        },
    },
    python: {},
    swift: {},
};

// Whether a node can never be substantial: a comment, an import, a shebang, or a bare name.
function isInert(node: Node): boolean {
    if (node.type.includes('comment') || node.type.startsWith('import')) return true;
    return node.type === 'hash_bang_line' || NAMES.has(node.type);
}

// Identify substantive nodes beyond imports, names, forwarding declarations, and trivial functions.
function isSubstantial(node: Node, language: CountedLanguage, threshold: number): boolean {
    if (isInert(node)) return false;
    if (COUNTED_FUNCTION_NODES.has(node.type)) return isSubstantialFunction(node, language, threshold);
    if (CONTAINER_NODES.has(node.type)) {
        const body = node.childForFieldName('body');
        return (body?.namedChildren ?? node.namedChildren)
            .filter((child) => !CONTAINER_NOISE.has(child.type))
            .some((child) => isSubstantial(child, language, threshold));
    }
    const substance = LANGUAGE_SUBSTANCE[language][node.type] ?? SUBSTANCE[node.type];
    return substance === undefined ? true : substance(node, language, threshold);
}

// The value assigned to __all__ by a statement, or undefined when the statement assigns something else.
function exportList(statement: Node): Node | undefined {
    const assignment = assignmentOf(statement);
    if (assignment?.childForFieldName('left')?.text !== '__all__') return undefined;
    return assignment.childForFieldName('right') ?? undefined;
}

/**
 * Count executable statements, excluding nested function bodies and type-only declarations.
 * @param nodes the body nodes
 * @param language the language the nodes were parsed as
 * @returns the count
 */
export function executableStatements(nodes: Node[], language: CountedLanguage): number {
    let count = 0;
    for (const node of nodes) {
        if (node.type.includes('comment') || TYPE_ALIASES.has(node.type)) continue;
        if (COUNTED_FUNCTION_NODES.has(node.type)) {
            if (!node.type.startsWith('lambda')) count += 1;
            continue;
        }
        count += STATEMENT_COUNTS[language](node) + executableStatements(node.namedChildren, language);
    }
    return count;
}

/**
 * Whether this Python string expression is the first statement after any comments.
 * @param node the candidate statement
 * @param siblings the statements in the same file or function body
 * @returns whether the string expression is a docstring
 */
export function isDocstring(node: Node, siblings: Node[]): boolean {
    return (
        node.type === 'expression_statement' &&
        node.namedChildren[0]?.type === 'string' &&
        siblings.find((sibling) => !sibling.type.includes('comment'))?.equals(node) === true
    );
}

/**
 * Whether every declaration is an import, alias, forwarding statement, or trivial function.
 * @param root the file's syntax tree
 * @param language the language the file was parsed as
 * @param threshold the statement count at or under which a function is trivial
 * @returns whether the file holds nothing substantial
 */
export function isTrivialFile(root: Node, language: CountedLanguage, threshold: number): boolean {
    const siblings = root.namedChildren;
    const statements = siblings.filter(
        (node) => !node.type.includes('comment') && !(language === 'python' && isDocstring(node, siblings)),
    );
    return statements.length > 0 && !statements.some((child) => isSubstantial(child, language, threshold));
}

/**
 * The message for a function at or under the statement limit.
 * @param name what the message calls the function, such as its name or "This function"
 * @param count the executable statements it holds
 * @param threshold the statement limit
 * @returns the message
 */
export function trivialText(name: string, count: number, threshold: number): string {
    const statements = count === 1 ? '1 statement' : `${String(count)} statements`;
    return `${name} has ${statements}. Functions with ${String(threshold)} or fewer are reported. Inline it into its callers, or record the API it serves with gspot ignore.`;
}

/**
 * Read selected Python sources and their function observations.
 * @param input the selected files and source reads
 * @returns parsed observations whose trees must be disposed
 */
export async function readPython(input: SourceInput): Promise<ParsedPython> {
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
 * Release the tree handles owned by Python observations.
 * @param parsed the observations whose readers have finished
 */
export function disposePython(parsed: ParsedPython): void {
    for (const source of parsed.modules) source.tree.delete();
}

/**
 * Separate native import declarations from rendered JavaScript without reading strings or comments as syntax.
 * @param text the rendered fragment
 * @returns import statements with their comments, and the remaining fragment body
 */
export function typescriptImports(text: string): TypescriptImports {
    const source = ts.createSourceFile('fragment.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const imports: string[] = [];
    const body: string[] = [];
    let through = 0;
    for (const statement of source.statements.filter((statement) => ts.isImportDeclaration(statement))) {
        const start = Math.max(through, statement.getFullStart());
        let end = ts.getTrailingCommentRanges(text, statement.end)?.at(-1)?.end ?? statement.end;
        if (text[end] === '\r') end += 1;
        if (text[end] === '\n') end += 1;
        body.push(text.slice(through, start));
        imports.push(text.slice(start, end).trim());
        through = end;
    }
    body.push(text.slice(through));
    return { imports, body: body.join('') };
}

/**
 * Walk the parsed TypeScript syntax once, visiting declarations and expressions without comment or string contents.
 * @param root the source or subtree to inspect
 * @returns nodes in source traversal order, including the root
 */
export function typescriptNodes(root: ts.Node): ts.Node[] {
    const nodes: ts.Node[] = [];
    const visit = (node: ts.Node): void => {
        nodes.push(node);
        ts.forEachChild(node, visit);
    };
    visit(root);
    return nodes;
}

/**
 * Bind selected syntax without reading dependencies or native library files.
 * @param sources the already captured source files by path
 * @returns the native program with lexical symbols for those sources
 */
export function typescriptProgram(sources: Map<string, ts.SourceFile>): ts.Program {
    const options: ts.CompilerOptions = { noLib: true, noResolve: true, allowJs: true };
    const host: ts.CompilerHost = {
        getSourceFile: (path) => sources.get(path),
        getDefaultLibFileName: () => '',
        writeFile: () => {},
        getCurrentDirectory: () => '',
        getDirectories: () => [],
        fileExists: (path) => sources.has(path),
        readFile: (path) => sources.get(path)?.text,
        getCanonicalFileName: (path) => path,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
    };
    return ts.createProgram([...sources.keys()], options, host);
}
