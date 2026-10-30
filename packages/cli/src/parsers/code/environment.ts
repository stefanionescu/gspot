import type ts from 'typescript';
import type { Node } from 'web-tree-sitter';
import { WHITESPACE_RUN } from '#cli/config/text.ts';
import { requireTypescript } from '#cli/system/typescript.ts';
import type { EnvironmentRead, EnvironmentKind, EnvironmentNames, EnvironmentScope } from '#cli/types/parsers/code.ts';

import {
    OS_MODULE,
    OCTAL_RADIX,
    VARIABLE_NAME,
    EXPANSION_NODES,
    ASTRO_EXTENSION,
    SCRIPT_LANGUAGE,
    COMPONENT_SCRIPT,
    HEXADECIMAL_RADIX,
    SWIFT_ENVIRONMENT,
    ASTRO_FRONT_MATTER,
    MAXIMUM_CODE_POINT,
    PYTHON_SCOPE_NODES,
    COMPONENT_EXTENSION,
    PYTHON_IMPORT_NODES,
    PYTHON_STRING_ESCAPE,
    PYTHON_STRING_ESCAPES,
    OS_ENVIRONMENT_MEMBERS,
    JAVASCRIPT_ENVIRONMENT_FIELDS,
    JAVASCRIPT_ENVIRONMENT_GETTERS,
} from '#cli/config/parsers/code.ts';

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

function findGetterKey(node: ts.CallExpression, source: ts.SourceFile, getters: Set<string>): string | undefined {
    const ts = requireTypescript();
    if (!getters.has(node.expression.getText(source).replaceAll(WHITESPACE_RUN, ''))) return undefined;
    const argument = node.arguments[0];
    return argument !== undefined && ts.isStringLiteralLike(argument) ? argument.text : undefined;
}

function findEnvironmentKey(node: ts.Node, source: ts.SourceFile, getters: Set<string>): string | undefined {
    const ts = requireTypescript();
    if (ts.isCallExpression(node)) return findGetterKey(node, source, getters);
    if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return undefined;
    if (!JAVASCRIPT_ENVIRONMENT_FIELDS.has(node.expression.getText(source).replaceAll(WHITESPACE_RUN, '')))
        return undefined;
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    return ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : undefined;
}

/**
Read environment members and calls to the environment functions in JavaScript or TypeScript.

@param path the original source path.
@param text the JavaScript or TypeScript source.
@param environmentFunctions the configured names that read process variables.
*/
export function listJavascriptEnvironmentReads(
    path: string,
    text: string,
    environmentFunctions: readonly string[],
): EnvironmentRead[] {
    const ts = requireTypescript();
    if (COMPONENT_EXTENSION.test(path)) {
        const front = path.endsWith(ASTRO_EXTENSION) ? ASTRO_FRONT_MATTER.exec(text)?.[1] : undefined;
        const frontReads =
            front === undefined ? [] : listJavascriptEnvironmentReads(`${path}.ts`, `\n${front}`, environmentFunctions);
        return [
            ...frontReads,
            ...[...text.matchAll(COMPONENT_SCRIPT)].flatMap((script) => {
                const body = script.groups?.['body'] ?? '';
                const language =
                    SCRIPT_LANGUAGE.exec(script.groups?.['attributes'] ?? '')?.groups?.['language'] ?? 'ts';
                const start = script.index + script[0].indexOf('>') + 1;
                const prefix = text.slice(0, start).replaceAll(/[^\r\n]/gu, ' ');
                return listJavascriptEnvironmentReads(`${path}.${language}`, prefix + body, environmentFunctions);
            }),
        ];
    }
    const source = ts.createSourceFile(
        path,
        text,
        ts.ScriptTarget.Latest,
        true,
        /\.[cm]?[jt]sx$/u.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const getters = new Set([...JAVASCRIPT_ENVIRONMENT_GETTERS, ...environmentFunctions]);
    const reads: EnvironmentRead[] = [];
    const visit = (node: ts.Node): void => {
        reads.push(...listDeclarationReads(node, source));
        const key = findEnvironmentKey(node, source, getters);
        if (key !== undefined && VARIABLE_NAME.test(key)) {
            const position = source.getLineAndCharacterOfPosition(node.getStart(source));
            reads.push({ key, line: position.line + 1, column: position.character + 1 });
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return reads;
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
            return { key, line: node.startPosition.row + 1, column: node.startPosition.column + 1 };
        });
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

function listDeclarationReads(node: ts.Node, source: ts.SourceFile): EnvironmentRead[] {
    const ts = requireTypescript();
    if (!ts.isVariableDeclaration(node) || !ts.isObjectBindingPattern(node.name) || node.initializer === undefined)
        return [];
    if (!JAVASCRIPT_ENVIRONMENT_FIELDS.has(node.initializer.getText(source).replaceAll(WHITESPACE_RUN, ''))) return [];
    return node.name.elements.flatMap((declaration) => {
        const property = declaration.propertyName ?? declaration.name;
        if (
            declaration.dotDotDotToken !== undefined ||
            (!ts.isIdentifier(property) && !ts.isStringLiteralLike(property))
        )
            return [];
        const key = property.text;
        if (!VARIABLE_NAME.test(key)) return [];
        const position = source.getLineAndCharacterOfPosition(property.getStart(source));
        return [{ key, line: position.line + 1, column: position.character + 1 }];
    });
}
