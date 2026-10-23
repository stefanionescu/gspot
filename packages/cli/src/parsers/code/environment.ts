import ts from 'typescript';
import type { Node } from 'web-tree-sitter';
import { EXPANSION_NODES } from '#cli/config/parsers/code/bash.ts';
import { listTypescriptNodes } from '#cli/parsers/code/typescript.ts';

import type {
    EnvironmentRead,
    EnvironmentKind,
    EnvironmentNames,
    EnvironmentScope,
} from '#cli/types/parsers/code/environment.ts';
import {
    ENV_NAME,
    OS_MODULE,
    SWIFT_ENV_READ,
    PYTHON_SCOPE_NODES,
    PYTHON_IMPORT_NODES,
    OS_ENVIRONMENT_MEMBERS,
    JAVASCRIPT_ENVIRONMENT_FIELDS,
    JAVASCRIPT_ENVIRONMENT_GETTERS,
} from '#cli/config/parsers/code/environment.ts';

/**
 * Read expansions of the environment names that the environment readers declare.
 *
 * @param syntaxRoot the parsed Bash source.
 * @param readerVariables the variables that environment readers declare.
 * @returns the environment reads and their source positions.
 */
export function listBashEnvironmentReads(syntaxRoot: Node, readerVariables: ReadonlySet<string>): EnvironmentRead[] {
    return syntaxRoot.descendantsOfType([...EXPANSION_NODES]).flatMap((expansion) =>
        expansion.namedChildren
            .filter((node) => node.type === 'variable_name' && readerVariables.has(node.text))
            .map((node) => ({
                key: node.text,
                line: node.startPosition.row + 1,
                column: node.startPosition.column + 1,
            })),
    );
}

/**
 * Read Swift process environment access from navigation expressions.
 *
 * @param syntaxRoot the parsed Swift source.
 * @returns the environment reads and their source positions.
 */
export function listSwiftEnvironmentReads(syntaxRoot: Node): EnvironmentRead[] {
    return syntaxRoot
        .descendantsOfType('navigation_expression')
        .filter((node) => node.text.replaceAll(/\s+/gu, '') === SWIFT_ENV_READ)
        .map((node) => ({ key: undefined, line: node.startPosition.row + 1, column: node.startPosition.column + 1 }));
}

function findGetterKey(node: ts.CallExpression, source: ts.SourceFile, getters: Set<string>): string | undefined {
    if (!getters.has(node.expression.getText(source).replaceAll(/\s+/gu, ''))) return undefined;
    const argument = node.arguments[0];
    return argument !== undefined && ts.isStringLiteralLike(argument) ? argument.text : undefined;
}

function findEnvironmentKey(node: ts.Node, source: ts.SourceFile, getters: Set<string>): string | undefined {
    if (ts.isCallExpression(node)) return findGetterKey(node, source, getters);
    if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return undefined;
    if (!JAVASCRIPT_ENVIRONMENT_FIELDS.has(node.expression.getText(source).replaceAll(/\s+/gu, ''))) return undefined;
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    return ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : undefined;
}

/**
 * Read environment members and calls to the environment functions in JavaScript or TypeScript.
 *
 * @param path the original source path.
 * @param text the JavaScript or TypeScript source.
 * @param environmentFunctions the configured names that read process variables.
 * @returns the environment reads and their source positions.
 */
export function listJavascriptEnvironmentReads(
    path: string,
    text: string,
    environmentFunctions: readonly string[],
): EnvironmentRead[] {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const getters = new Set([...JAVASCRIPT_ENVIRONMENT_GETTERS, ...environmentFunctions]);
    return listTypescriptNodes(source).flatMap((node) => {
        const key = findEnvironmentKey(node, source, getters);
        if (key === undefined || !ENV_NAME.test(key)) return [];
        const at = source.getLineAndCharacterOfPosition(node.getStart(source));
        return [{ key, line: at.line + 1, column: at.character + 1 }];
    });
}

// Bindings inside a function or class belong to that lexical scope.
function findDeclarationScope(node: Node): Node {
    let scope = node.parent ?? node;
    while (scope.parent !== null && !PYTHON_SCOPE_NODES.has(scope.type)) scope = scope.parent;
    return scope;
}

// An import alias keeps the module or member that it names.
function getImportAlias(node: Node) {
    if (node.type !== 'aliased_import') return { name: node.text, target: node.text };
    return { name: node.childForFieldName('alias')?.text, target: node.childForFieldName('name')?.text };
}

// Parameters declare their own names, not the names that their default expressions use.
function listBoundNames(node: Node): string[] {
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
function listEnvironmentImports(node: Node): EnvironmentScope {
    const imported: EnvironmentScope = new Map();
    let members: Record<string, EnvironmentKind> = {};
    if (node.type === 'import_statement') members = { [OS_MODULE]: OS_MODULE };
    else if (node.childForFieldName('module_name')?.text === OS_MODULE) members = OS_ENVIRONMENT_MEMBERS;
    for (const nameNode of node.childrenForFieldName('name')) {
        const { name, target } = getImportAlias(nameNode);
        if (name !== undefined && target !== undefined) imported.set(name, members[target]);
    }
    return imported;
}

// Map each scope of a file to the names it declares, and to what each import of os names, once for each file.
function listPythonNames(root: Node): EnvironmentNames {
    const scopeNames: EnvironmentNames = new Map();
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
        const names = scopeNames.get(scope) ?? new Map<string, EnvironmentKind>();
        const bound = PYTHON_IMPORT_NODES.has(node.type)
            ? listEnvironmentImports(node)
            : new Map<string, EnvironmentKind>(listBoundNames(node).map((name) => [name, undefined]));
        for (const [name, kind] of bound) names.set(name, kind);
        scopeNames.set(scope, names);
    }
    return scopeNames;
}

// Find what a name refers to: look for its declaration in each enclosing scope, from the innermost out.
function findEnvironmentKind(node: Node, name: string, scopeNames: EnvironmentNames): EnvironmentKind {
    for (
        let scope: Node | null = findDeclarationScope(node);
        scope !== null;
        scope = scope.parent === null ? null : findDeclarationScope(scope)
    ) {
        const names = scopeNames.get(scope.id);
        if (names?.has(name) === true) return names.get(name);
    }
    return undefined;
}

// Reads name an object or the function called, never the text inside a string.
function findReceiver(node: Node): Node | null {
    if (node.type === 'attribute') return node.childForFieldName('object');
    if (node.type === 'call') {
        const called = node.childForFieldName('function');
        return called?.type === 'attribute' ? called.childForFieldName('object') : (called ?? null);
    }
    return node;
}

function isPythonEnvironmentRead(node: Node, names: EnvironmentNames, environment: Set<number>): boolean {
    const receiver = findReceiver(node);
    if (receiver?.type !== 'identifier') return false;
    const kind = findEnvironmentKind(node, receiver.text, names);
    if (kind === OS_MODULE) return environment.has(node.id);
    if (kind === 'getenv') return node.type === 'call';
    return kind === 'environ';
}

function isEnvironmentRead(
    node: Node,
    environmentFunctions: readonly string[],
    names: EnvironmentNames,
    environment: Set<number>,
): boolean {
    if (node.type === 'call' && environmentFunctions.includes(node.childForFieldName('function')?.text ?? ''))
        return true;
    if (node.type === 'identifier' && node.parent?.type !== 'subscript') return false;
    return isPythonEnvironmentRead(node, names, environment);
}

function expandEnvironmentExpression(node: Node): Node {
    const parent = node.parent;
    const expression =
        parent?.type === 'attribute' && parent.childForFieldName('attribute')?.text === 'get' ? parent : node;
    const container = expression.parent;
    return container !== null && (container.type === 'subscript' || container.type === 'call') ? container : expression;
}

function findEnvironmentKeyNode(node: Node): Node | null | undefined {
    const expression = expandEnvironmentExpression(node);
    if (expression.type === 'subscript') return expression.childForFieldName('subscript');
    if (expression.type === 'call') return expression.childForFieldName('arguments')?.namedChildren[0];
    return undefined;
}

/**
 * Read Python environment access and calls to the environment functions, through import aliases.
 *
 * @param syntaxRoot the parsed Python source.
 * @param environmentFunctions the configured names that read process variables.
 * @returns the environment reads and their source positions.
 */
export function listPythonEnvironmentReads(
    syntaxRoot: Node,
    environmentFunctions: readonly string[],
): EnvironmentRead[] {
    const pythonNames = listPythonNames(syntaxRoot);
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
        if (!isEnvironmentRead(node, environmentFunctions, pythonNames, environment)) return [];
        const literal = findEnvironmentKeyNode(node);
        const key =
            literal?.type === 'string'
                ? literal.namedChildren.find((child) => child.type === 'string_content')?.text
                : undefined;
        return [{ key, line: node.startPosition.row + 1, column: node.startPosition.column + 1 }];
    });
}
