import type { Node } from 'web-tree-sitter';
import type { PythonModule } from '#cli/checks/python/types.ts';
import type { StructureProblem } from '#cli/checks/structure/engine.ts';

const SINGLETONS_ALLOWED = new Set(['app', 'router', 'logger', 'log', 'settings']);
const CLASS_CALL = /^[A-Z][A-Za-z\d]*\(/u;

function dottedName(path: string): string {
    return path
        .replace(/\.py$/u, '')
        .replace(/\/__init__$/u, '')
        .replaceAll('/', '.');
}

// The module a from-import starts at: an absolute name, or a relative one counted up from the current module.
function sourceModule(source: Node, current: string): string {
    if (source.type !== 'relative_import') return source.text;
    const dots = /^\.+/u.exec(source.text)?.[0].length ?? 1;
    const base = current.split('.').slice(0, -dots).join('.');
    const rest = source.text.replace(/^\.+/u, '');
    return [base, rest].filter((part) => part !== '').join('.');
}

// Every name an import statement may reach: a from-import of a name may be a module of that package, so both are candidates.
function importedModules(statement: Node, current: string): string[] {
    if (statement.type === 'import_statement')
        return statement.namedChildren.map((child) => (child.childForFieldName('name') ?? child).text);
    if (statement.type !== 'import_from_statement') return [];
    const source = statement.childForFieldName('module_name');
    if (source === null) return [];
    const base = sourceModule(source, current);
    const members = statement
        .childrenForFieldName('name')
        .map((name) => `${base}.${(name.childForFieldName('name') ?? name).text}`);
    return members.length === 0 ? [base] : members;
}

// The longest first-party module an import names: importing shop.orders.make reaches shop.orders.
function resolved(name: string, known: Set<string>): string | undefined {
    const parts = name.split('.');
    for (let size = parts.length; size > 0; size -= 1) {
        const candidate = parts.slice(0, size).join('.');
        if (known.has(candidate)) return candidate;
    }
    return undefined;
}

// The modules a module reaches through imports, each with the trail that led there.
function reached(start: string, graph: Map<string, string[]>): Map<string, string[]> {
    const trails = new Map<string, string[]>();
    const queue: string[][] = [[start]];
    while (queue.length > 0) {
        const trail = queue.shift() ?? [];
        const fresh = (graph.get(trail.at(-1) ?? '') ?? []).filter((next) => !trails.has(next));
        for (const next of fresh) trails.set(next, [...trail, next]);
        queue.push(...fresh.map((next) => [...trail, next]));
    }
    return trails;
}

function assignmentOf(statement: Node): Node | undefined {
    const first = statement.type === 'expression_statement' ? statement.namedChildren[0] : undefined;
    return first?.type === 'assignment' ? first : undefined;
}

// A module variable that holds an object built from a class at import time, or undefined. A name in capitals is a constant.
function builtAtImport(statement: Node): string | undefined {
    const assignment = assignmentOf(statement);
    const name = assignment?.childForFieldName('left');
    const built = assignment?.childForFieldName('right');
    if (name?.type !== 'identifier' || !(built?.type === 'call' && CLASS_CALL.test(built.text))) return undefined;
    return name.text === name.text.toUpperCase() ? undefined : name.text;
}

/**
 * Import cycles among the first-party modules. Each cycle is reported once, on the module whose name sorts first.
 * @param modules every module of the run
 * @returns the problems
 */
export function importCycles(modules: PythonModule[]): StructureProblem[] {
    const names = new Map(modules.map((module) => [dottedName(module.path), module]));
    const known = new Set(names.keys());
    const graph = new Map(
        [...names].map(([name, module]): [string, string[]] => [
            name,
            module.statements
                .flatMap((statement) => importedModules(statement, name))
                .flatMap((imported) => {
                    const target = resolved(imported, known);
                    return target === undefined || target === name ? [] : [target];
                }),
        ]),
    );
    return [...names].flatMap(([name, module]) => {
        const cycle = reached(name, graph).get(name);
        const first = cycle?.toSorted((a, b) => a.localeCompare(b))[0];
        if (cycle === undefined || first !== name) return [];
        return [
            {
                file: module.path,
                line: 1,
                rule: 'import-cycle',
                text: `These modules import each other in a circle: ${cycle.join(' -> ')}.`,
            },
        ];
    });
}

/**
 * Objects built when the module is imported: one shared instance that every importer gets and no test replaces.
 * @param modules every module of the run
 * @param allowed the names the policy allows beside the shipped ones
 * @returns the problems
 */
export function singletons(modules: PythonModule[], allowed: Set<string>): StructureProblem[] {
    return modules.flatMap((module) =>
        module.statements.flatMap((statement): StructureProblem[] => {
            const name = builtAtImport(statement);
            if (name === undefined || SINGLETONS_ALLOWED.has(name) || allowed.has(name)) return [];
            return [
                {
                    file: module.path,
                    line: statement.startPosition.row + 1,
                    rule: 'no-singletons',
                    text: `${name} is built when the module is imported, so every importer shares it. Build it where it is used, and pass it in.`,
                },
            ];
        }),
    );
}
