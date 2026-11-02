import type { Node } from 'web-tree-sitter';
import { readComponentSources } from '#cli/parsers/code/comments.ts';
import { parseSource, findGrammarByExtension } from '#cli/parsers/code/grammars.ts';

import type {
    ParseCache,
    EnvironmentRead,
    EnvironmentKind,
    ComponentScript,
    EnvironmentNames,
    EnvironmentScope,
} from '#cli/types/parsers.ts';
import {
    OS_MODULE,
    OCTAL_RADIX,
    VARIABLE_NAME,
    WHITESPACE_RUN,
    EXPANSION_NODES,
    HEXADECIMAL_RADIX,
    SWIFT_ENVIRONMENT,
    MAXIMUM_CODE_POINT,
    PYTHON_SCOPE_NODES,
    COMPONENT_EXTENSION,
    PYTHON_IMPORT_NODES,
    PYTHON_LITERAL_NODES,
    PYTHON_STRING_ESCAPE,
    PYTHON_STRING_ESCAPES,
    OS_ENVIRONMENT_MEMBERS,
    JAVASCRIPT_LITERAL_NODES,
    JAVASCRIPT_PROPERTY_NODES,
    JAVASCRIPT_DEFAULT_OPERATORS,
    JAVASCRIPT_ENVIRONMENT_FIELDS,
    JAVASCRIPT_ENVIRONMENT_GETTERS,
} from '#cli/config/parsers.ts';

function readCallKey(node: Node, getters: Set<string>): string | undefined {
    const name = node.childForFieldName('function')?.text.replaceAll(WHITESPACE_RUN, '');
    if (name === undefined || !getters.has(name)) return undefined;
    return readStringLiteral(node.childForFieldName('arguments')?.namedChild(0));
}

function readMemberKey(node: Node): string | undefined {
    const receiver = node.childForFieldName('object')?.text.replaceAll(WHITESPACE_RUN, '');
    if (receiver === undefined || !JAVASCRIPT_ENVIRONMENT_FIELDS.has(receiver)) return undefined;
    return node.type === 'member_expression'
        ? node.childForFieldName('property')?.text
        : readStringLiteral(node.childForFieldName('index'));
}

function hasPythonDefault(keyNode: Node | null | undefined): boolean {
    const call = keyNode?.parent;
    const defaultValue = call?.type === 'argument_list' ? call.namedChildren[1] : undefined;
    return defaultValue !== undefined && PYTHON_LITERAL_NODES.has(defaultValue.type);
}

function hasLiteralDefault(node: Node): boolean {
    const { parent } = node;
    if (parent?.type !== 'binary_expression' || parent.childForFieldName('left')?.id !== node.id) return false;
    const operator = parent.childForFieldName('operator')?.type ?? '';
    const right = parent.childForFieldName('right');
    return (
        JAVASCRIPT_DEFAULT_OPERATORS.has(operator) &&
        (readStringLiteral(right) !== undefined || JAVASCRIPT_LITERAL_NODES.has(right?.type ?? ''))
    );
}

function findDeclarationScope(node: Node): Node {
    let scope = node.parent ?? node;
    while (scope.parent !== null && !PYTHON_SCOPE_NODES.has(scope.type)) scope = scope.parent;
    return scope;
}

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

function listEnvironmentImports(node: Node): EnvironmentScope {
    const imported: EnvironmentScope = new Map();
    let members: Record<string, EnvironmentKind> = {};
    if (node.type === 'import_statement') members = { [OS_MODULE]: OS_MODULE };
    else if (node.childForFieldName('module_name')?.text === OS_MODULE) members = OS_ENVIRONMENT_MEMBERS;
    const aliases = node
        .childrenForFieldName('name')
        .map((nameNode) =>
            nameNode.type === 'aliased_import'
                ? { name: nameNode.childForFieldName('alias')?.text, target: nameNode.childForFieldName('name')?.text }
                : { name: nameNode.text, target: nameNode.text },
        );
    for (const { name, target } of aliases)
        if (name !== undefined && target !== undefined) imported.set(name, members[target]);
    return imported;
}

function listPythonNames(syntaxRoot: Node): EnvironmentNames {
    const scopeNames: EnvironmentNames = new Map();
    const nodes = [
        ...syntaxRoot.descendantsOfType([...PYTHON_IMPORT_NODES]),
        ...syntaxRoot.descendantsOfType([
            'assignment',
            'for_statement',
            'function_definition',
            'class_definition',
            'parameters',
        ]),
    ];
    for (const node of nodes) {
        const scope = findDeclarationScope(node).id;
        const names = scopeNames.get(scope) ?? new Map<string, { position: number; kind: EnvironmentKind }[]>();
        const bound = PYTHON_IMPORT_NODES.has(node.type)
            ? listEnvironmentImports(node)
            : new Map<string, EnvironmentKind>(listBoundNames(node).map((name) => [name, undefined]));
        for (const [name, kind] of bound)
            names.set(name, [...(names.get(name) ?? []), { position: node.startIndex, kind }]);
        scopeNames.set(scope, names);
    }
    return scopeNames;
}

function findEnvironmentKind(node: Node, name: string, scopeNames: EnvironmentNames): EnvironmentKind {
    let scope = findDeclarationScope(node);
    for (;;) {
        const declarations = scopeNames.get(scope.id)?.get(name);
        const declaration = declarations
            ?.filter((property) => property.position <= node.startIndex)
            .toSorted((left, right) => right.position - left.position)[0];
        if (declaration !== undefined) return declaration.kind;
        if (scope.parent === null) return undefined;
        scope = findDeclarationScope(scope);
    }
}

function findReceiver(node: Node): Node | null {
    if (node.type === 'attribute') return node.childForFieldName('object');
    if (node.type === 'call') {
        const called = node.childForFieldName('function');
        return called?.type === 'attribute' ? called.childForFieldName('object') : (called ?? null);
    }
    return node;
}

function isPythonEnvironmentRead(node: Node, names: EnvironmentNames, accessIds: Set<number>): boolean {
    const receiver = findReceiver(node);
    if (receiver?.type !== 'identifier') return false;
    const kind = findEnvironmentKind(node, receiver.text, names);
    if (kind === OS_MODULE) return accessIds.has(node.id);
    return kind === 'getenv' ? node.type === 'call' : kind === 'environ';
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
    return expression.type === 'call' ? expression.childForFieldName('arguments')?.namedChildren[0] : undefined;
}

function decodePythonKey(literal: Node): string | undefined {
    const value = literal.namedChildren.find((child) => child.type === 'string_content')?.text;
    if (value === undefined || /^[BFTU]*R[BFRTU]*["']/iu.test(literal.text)) return value;
    return value.replaceAll(
        PYTHON_STRING_ESCAPE,
        (
            escape,
            hexadecimal: string | undefined,
            unicode: string | undefined,
            longUnicode: string | undefined,
            octal: string | undefined,
            character: string | undefined,
        ) => {
            const digits = [hexadecimal, unicode, longUnicode, octal].find((value) => value !== undefined);
            if (digits !== undefined) {
                const point = Number.parseInt(digits, octal === undefined ? HEXADECIMAL_RADIX : OCTAL_RADIX);
                return point <= MAXIMUM_CODE_POINT ? String.fromCodePoint(point) : escape;
            }
            return PYTHON_STRING_ESCAPES[character ?? ''] ?? escape;
        },
    );
}

function findBoundProperty(element: Node): Node | null {
    if (element.type === 'pair_pattern') return element.childForFieldName('key');
    return element.type === 'object_assignment_pattern' ? element.childForFieldName('left') : element;
}

function readPropertyName(property: Node | null): string | undefined {
    if (property?.type === 'string') return readStringLiteral(property);
    return property !== null && JAVASCRIPT_PROPERTY_NODES.has(property.type) ? property.text : undefined;
}

function listDeclarationReads(node: Node): EnvironmentRead[] {
    const pattern = node.childForFieldName('name');
    const value = node.childForFieldName('value')?.text.replaceAll(WHITESPACE_RUN, '');
    if (pattern?.type !== 'object_pattern' || value === undefined || !JAVASCRIPT_ENVIRONMENT_FIELDS.has(value))
        return [];
    return pattern.namedChildren.flatMap((element) => {
        const property = findBoundProperty(element);
        const key = readPropertyName(property);
        if (property === null || key === undefined || !VARIABLE_NAME.test(key)) return [];
        return [{ key, line: property.startPosition.row + 1, column: property.startPosition.column + 1 }];
    });
}

function listTreeReads(syntaxRoot: Node, getters: Set<string>): EnvironmentRead[] {
    return syntaxRoot
        .descendantsOfType(['variable_declarator', 'call_expression', 'member_expression', 'subscript_expression'])
        .flatMap((node) => {
            if (node.type === 'variable_declarator') return listDeclarationReads(node);
            const key = node.type === 'call_expression' ? readCallKey(node, getters) : readMemberKey(node);
            if (key === undefined || !VARIABLE_NAME.test(key)) return [];
            return [
                {
                    key,
                    line: node.startPosition.row + 1,
                    column: node.startPosition.column + 1,
                    ...(hasLiteralDefault(node) && { hasDefault: true }),
                },
            ];
        });
}

/**
Read expansions of the environment names that the environment readers declare.

@param syntaxRoot the parsed Bash source.
@param readerVariables the variables that environment readers declare.
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
Read Swift process environment access from navigation expressions.

@param syntaxRoot the parsed Swift source.
*/
export function listSwiftEnvironmentReads(syntaxRoot: Node): EnvironmentRead[] {
    return syntaxRoot
        .descendantsOfType('navigation_expression')
        .filter((node) => node.text.replaceAll(WHITESPACE_RUN, '') === SWIFT_ENVIRONMENT)
        .map((node) => ({ key: undefined, line: node.startPosition.row + 1, column: node.startPosition.column + 1 }));
}

/**
Read the text of a string or a template without substitutions.

@param node the expression.
@returns undefined for any other expression.
*/
export function readStringLiteral(node: Node | null | undefined): string | undefined {
    if (node?.type === 'string') return node.text.slice(1, -1);
    const isStaticTemplate =
        node?.type === 'template_string' && node.namedChildren.every(({ type }) => type !== 'template_substitution');
    return isStaticTemplate ? node.text.slice(1, -1) : undefined;
}

/**
List the JavaScript and TypeScript sources of a file: the file itself, or the scripts of a component.

@param path the original source path.
@param text the source.
@returns each source with its grammar.
*/
export async function listJavascriptSources(path: string, text: string): Promise<ComponentScript[]> {
    if (!COMPONENT_EXTENSION.test(path))
        return [{ grammar: findGrammarByExtension(path) ?? 'typescript', source: text }];
    const { scripts } = await readComponentSources(text, path);
    return scripts;
}

/**
Read environment members and calls to the environment functions in JavaScript or TypeScript.

@param path the original source path.
@param text the JavaScript or TypeScript source.
@param environmentFunctions the configured names that read process variables.
@param cache the parsed trees of this run.
*/
export async function listJavascriptEnvironmentReads(
    path: string,
    text: string,
    environmentFunctions: readonly string[],
    cache?: ParseCache,
): Promise<EnvironmentRead[]> {
    const getters = new Set([...JAVASCRIPT_ENVIRONMENT_GETTERS, ...environmentFunctions]);
    const reads: EnvironmentRead[] = [];
    for (const { grammar, source } of await listJavascriptSources(path, text)) {
        using tree = await parseSource(grammar, source, cache);
        reads.push(...listTreeReads(tree.rootNode, getters));
    }
    return reads;
}

/**
Read Python environment access and calls to the environment functions, through import aliases.

@param syntaxRoot the parsed Python source.
@param environmentFunctions the configured names that read process variables.
*/
export function listPythonEnvironmentReads(
    syntaxRoot: Node,
    environmentFunctions: readonly string[],
): EnvironmentRead[] {
    const pythonNames = listPythonNames(syntaxRoot);
    const nodes = syntaxRoot.descendantsOfType(['attribute', 'call', 'identifier']);
    const accessIds = new Set(
        nodes
            .filter((node) =>
                node.type === 'attribute'
                    ? node.childForFieldName('attribute')?.text === 'environ'
                    : node.type === 'call' &&
                      node.childForFieldName('function')?.childForFieldName('attribute')?.text === 'getenv',
            )
            .map((node) => node.id),
    );
    return nodes
        .filter(
            (node) =>
                (node.type === 'call' &&
                    environmentFunctions.includes(node.childForFieldName('function')?.text ?? '')) ||
                ((node.type !== 'identifier' || node.parent?.type === 'subscript') &&
                    isPythonEnvironmentRead(node, pythonNames, accessIds)),
        )
        .map((node) => {
            const literal = findEnvironmentKeyNode(node);
            const key =
                literal?.type === 'string' && literal.descendantsOfType('interpolation').length === 0
                    ? decodePythonKey(literal)
                    : undefined;
            return {
                key,
                line: node.startPosition.row + 1,
                column: node.startPosition.column + 1,
                ...(hasPythonDefault(literal) && { hasDefault: true }),
            };
        });
}
