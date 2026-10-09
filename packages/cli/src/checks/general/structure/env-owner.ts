import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/finding.ts';
import { visitParsed } from '#cli/parsers/source/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { rolePaths } from '#cli/policy/settings/contracts.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import { IMPORTS } from '#cli/config/checks/language/python.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { ENVIRONMENT_READ } from '#cli/config/checks/language/swift.ts';
import { OS_ENVIRONMENT_MEMBERS } from '#cli/config/checks/general/structure.ts';
import { readHouseSources, disposeHouseSources } from '#cli/checks/general/structure/conventions.ts';

import type {
    HouseSource,
    EnvironmentKind,
    EnvironmentScope,
    EnvironmentNames,
} from '#cli/types/checks/general/structure.ts';

// Bindings inside a function or class belong to that lexical scope.
function bindingScope(node: Node): Node {
    let scope = node.parent ?? node;
    while (scope.parent !== null && !['function_definition', 'class_definition', 'lambda'].includes(scope.type))
        scope = scope.parent;
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

// Native os imports are the only bindings that supply environment objects or getters.
function importNames(node: Node): EnvironmentScope {
    const entries: EnvironmentScope = new Map();
    let members: Record<string, EnvironmentKind> = {};
    if (node.type === 'import_statement') members = { os: 'os' };
    else if (node.childForFieldName('module_name')?.text === 'os') members = OS_ENVIRONMENT_MEMBERS;
    for (const item of node.childrenForFieldName('name')) {
        const { name, target } = importName(item);
        if (name !== undefined && target !== undefined) entries.set(name, members[target]);
    }
    return entries;
}

// Import identities and lexical declarations are calculated once for each source.
function pythonNames(source: HouseSource): EnvironmentNames {
    const entries: EnvironmentNames = new Map();
    const nodes = [...(source.captures.get('import') ?? []), ...(source.captures.get('binding') ?? [])];
    for (const node of nodes) {
        const scope = bindingScope(node).id;
        const names = entries.get(scope) ?? new Map<string, EnvironmentKind>();
        const declared = IMPORTS.has(node.type)
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

// Only native os environment objects and calls use the declared environment owner.
function pythonEnvironment(node: Node, entries: EnvironmentNames, environment: Set<number>): boolean {
    const receiver = readReceiver(node);
    if (receiver?.type !== 'identifier') return false;
    const kind = environmentKind(node, receiver.text, entries);
    if (kind === 'os') return environment.has(node.id);
    if (kind === 'getenv') return node.type === 'call';
    return kind === 'environ';
}

/**
 * Report native environment reads outside the scope's declared environment owner.
 * @param input the selected sources and effective architecture roles
 * @returns findings on the original reading lines
 */
export async function envOwner(input: CheckInput): Promise<Finding[]> {
    const owners = rolePaths(input.view.roles, 'env');
    if (owners.length === 0) return [];
    const isOwner = pathMatcher(owners);
    using parsed = await visitParsed(input, readHouseSources, disposeHouseSources);
    const owned = new Set(
        parsed.value
            .filter((source) => source.language === 'bash' && isOwner(source.path))
            .flatMap((source) =>
                (source.captures.get('assignment') ?? []).flatMap((node) => {
                    let parent = node.parent;
                    while (parent !== null && parent.type !== 'function_definition') parent = parent.parent;
                    const name = node.childForFieldName('name')?.text;
                    return parent === null && name !== undefined && /^[A-Z_][A-Z0-9_]*$/u.test(name) ? [name] : [];
                }),
            ),
    );
    return parsed.value.flatMap((source) => {
        if (isOwner(source.path)) return [];
        const entries: EnvironmentNames =
            source.language === 'python' ? pythonNames(source) : new Map<number, EnvironmentScope>();
        const environment = new Set((source.captures.get('environment') ?? []).map((node) => node.id));
        const reads = (source.captures.get('read') ?? []).filter((node) => {
            if (source.language === 'swift') return node.text.replaceAll(/\s+/gu, '') === ENVIRONMENT_READ;
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
                    ? `${node.text} is read here but declared by the environment owner; read it there and pass the value in.`
                    : 'The process environment is read here, outside the environment owner. Read it there and pass the value in.';
            return findingAt(input, { file: source.path, line }, 'read-outside-owner', message);
        });
    });
}
