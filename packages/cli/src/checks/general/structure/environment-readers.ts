import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/finding.ts';
import { parseCached } from '#cli/system/files/cache.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { CONVENTION_SOURCES } from '#cli/checks/general/structure/convention-sources.ts';

import type {
    EnvironmentKind,
    ConventionSource,
    EnvironmentNames,
    EnvironmentScope,
} from '#cli/types/checks/general.ts';
import {
    ENV_NAME,
    OS_MODULE,
    SWIFT_ENV_READ,
    PYTHON_SCOPE_NODES,
    PYTHON_IMPORT_NODES,
    OS_ENVIRONMENT_MEMBERS,
} from '#cli/config/checks/general/structure.ts';

// Bindings inside a function or class belong to that lexical scope.
function bindingScope(node: Node): Node {
    let scope = node.parent ?? node;
    while (scope.parent !== null && !PYTHON_SCOPE_NODES.has(scope.type)) scope = scope.parent;
    return scope;
}

// Import aliases retain the actual module or member identity.
function importName(node: Node) {
    if (node.type !== 'aliased_import') return { name: node.text, target: node.text };
    return { name: node.childForFieldName('alias')?.text, target: node.childForFieldName('name')?.text };
}

// Native parameters declare names rather than the names used by their default expressions.
function bindingNames(node: Node): string[] {
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
        const { name, target } = importName(item);
        if (name !== undefined && target !== undefined) entries.set(name, members[target]);
    }
    return entries;
}

// Calculate import identities and lexical declarations once for each source.
function pythonNames(source: ConventionSource): EnvironmentNames {
    const entries: EnvironmentNames = new Map();
    const nodes = [...(source.captures.get('import') ?? []), ...(source.captures.get('binding') ?? [])];
    for (const node of nodes) {
        const scope = bindingScope(node).id;
        const names = entries.get(scope) ?? new Map<string, EnvironmentKind>();
        const declared = PYTHON_IMPORT_NODES.has(node.type)
            ? importNames(node)
            : new Map<string, EnvironmentKind>(bindingNames(node).map((name) => [name, undefined]));
        for (const [name, kind] of declared) names.set(name, kind);
        entries.set(scope, names);
    }
    return entries;
}

// Resolve lexical imports before applying the environment read rule.
function environmentKind(node: Node, name: string, entries: EnvironmentNames): EnvironmentKind {
    for (
        let scope: Node | null = bindingScope(node);
        scope !== null;
        scope = scope.parent === null ? null : bindingScope(scope)
    ) {
        const names = entries.get(scope.id);
        if (names?.has(name) === true) return names.get(name);
    }
    return undefined;
}

// Native reads name an object or call target, never the text inside a string.
function readReceiver(node: Node): Node | null {
    if (node.type === 'attribute') return node.childForFieldName('object');
    if (node.type === 'call') return node.childForFieldName('function');
    return node;
}

// Find Python os environment objects and calls.
function pythonEnvironment(node: Node, entries: EnvironmentNames, environment: Set<number>): boolean {
    const receiver = readReceiver(node);
    if (receiver?.type !== 'identifier') return false;
    const kind = environmentKind(node, receiver.text, entries);
    if (kind === OS_MODULE) return environment.has(node.id);
    if (kind === 'getenv') return node.type === 'call';
    return kind === 'environ';
}

/**
 * Report environment reads outside the scope's declared reader files.
 * @param input the selected sources and effective architecture roles.
 * @returns findings on the original reading lines.
 */
export async function envReads(input: CheckInput): Promise<Finding[]> {
    const readerPaths = input.selection.view.roles['environment_readers'];
    if (readerPaths.length === 0) return [];
    const isReader = buildPathMatcher(readerPaths);
    const parsed = await parseCached(input, CONVENTION_SOURCES);
    const owned = new Set(
        parsed
            .filter((source) => source.language === 'bash' && isReader(source.path))
            .flatMap((source) =>
                (source.captures.get('assignment') ?? []).flatMap((node) => {
                    let parent = node.parent;
                    while (parent !== null && parent.type !== 'function_definition') parent = parent.parent;
                    const name = node.childForFieldName('name')?.text;
                    return parent === null && name !== undefined && ENV_NAME.test(name) ? [name] : [];
                }),
            ),
    );
    return parsed.flatMap((source) => {
        if (isReader(source.path)) return [];
        const entries: EnvironmentNames =
            source.language === 'python' ? pythonNames(source) : new Map<number, EnvironmentScope>();
        const environment = new Set((source.captures.get('environment') ?? []).map((node) => node.id));
        const reads = (source.captures.get('read') ?? []).filter((node) => {
            if (source.language === 'swift') return node.text.replaceAll(/\s+/gu, '') === SWIFT_ENV_READ;
            if (source.language === 'bash') return owned.has(node.text);
            if (node.type === 'identifier' && node.parent?.type !== 'subscript') return false;
            return pythonEnvironment(node, entries, environment);
        });
        const lines = new Map<number, Node>();
        for (const node of reads)
            if (!lines.has(node.startPosition.row + 1)) lines.set(node.startPosition.row + 1, node);
        return [...lines].map(([line, node]) => {
            const message =
                source.language === 'bash'
                    ? `${node.text} is read here. Read environment variables only in the files that architecture.roles.environment_readers lists, and pass the value in.`
                    : 'Read environment variables only in the files that architecture.roles.environment_readers lists, and pass the value in.';
            return findingAt(input, { file: source.path, line }, 'read-outside-owner', message);
        });
    });
}
