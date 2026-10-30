import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { read } from '#cli/system/files/reads.ts';
import { escapeGlob } from '#cli/system/paths.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { findImportedModule } from '#cli/parsers/code/swift.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import { SWIFT_IMPORT_NODE } from '#cli/config/parsers/code/swift.ts';
import type { ImportRule } from '#cli/types/settings/import-rules.ts';
import { NODE_SHEBANG_TAG } from '#cli/config/repository/files/classify.ts';
import { SWIFT_EXTENSION, MISE_TASKS_GLOB } from '#cli/config/files/names.ts';
import { listSwiftModules } from '#cli/checks/general/structure/swift-modules.ts';
import { listAllowedRules, formatRefusedImport } from '#cli/settings/import-rules.ts';
import { SWIFT_CONFIGURATION, PYTHON_CONFIGURATION } from '#cli/config/manifests/names.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';
import { IMPORT_RULE_CATEGORY } from '#cli/config/generation/configurations/language/javascript/eslint/blocks/boundaries.ts';

import {
    type RuleLookup,
    type SwiftModule,
    type ImportOwners,
    type PythonSearch,
    type LocatedImport,
} from '#cli/types/checks/general/structure.ts';
import {
    RULES,
    RELATIVE_IMPORT,
    IMPORT_RULES_SKIP,
    PYTHON_EXTENSIONS,
    PYTHON_SOURCE_ROOTS,
    CONFIG_FILE_PATTERNS,
    PYTHON_FROM_STATEMENT,
    PYTHON_MODULE_SUFFIXES,
    UNCOVERED_FILE_MESSAGE,
    IMPORT_RULE_EXTENSIONS,
    PYTHON_IMPORT_STATEMENT,
} from '#cli/config/checks/general/structure/import-rules.ts';

function buildRuleLookup(rules: ImportRule[]): RuleLookup {
    const matchers = rules.map((rule) => buildPathMatcher(rule.paths));
    return {
        rules,
        findOwner: (path) => {
            const index = matchers.findIndex((matches) => matches(path));
            return index === -1 ? undefined : index;
        },
        allowed: rules.map((_rule, index) => listAllowedRules(rules, index)),
    };
}

function buildExemption(planned: PlannedCheck): (file: TrackedFile) => boolean {
    const { settings, path: scopePath } = planned.scope;
    const matches = buildPathMatcher([
        ...settings.test_files,
        ...CONFIG_FILE_PATTERNS,
        ...(settings.tables[ESLINT_SETTINGS_TABLE]?.plugins ?? []).map((plugin) => plugin.path),
        ...(settings.tables.javascript?.script_files ?? []),
        joinScope(escapeGlob(scopePath), MISE_TASKS_GLOB),
    ]);
    return (file) => matches(file.path) || file.tags.includes(NODE_SHEBANG_TAG);
}

function listUncoveredFiles(planned: PlannedCheck, lookup: RuleLookup): CheckFinding[] {
    const isExempt = buildExemption(planned);
    return planned.files
        .filter(
            (file) =>
                file.kind === 'source' &&
                IMPORT_RULE_EXTENSIONS.some((extension) => file.path.endsWith(extension)) &&
                !isExempt(file) &&
                lookup.findOwner(file.path) === undefined,
        )
        .map((file) => ({
            file: file.path,
            line: 1,
            rule: RULES.uncoveredFile,
            message: UNCOVERED_FILE_MESSAGE,
        }));
}

function findRefusedOwner(lookup: RuleLookup, from: number, owners: (number | undefined)[]): string | undefined {
    const allowed = lookup.allowed[from] ?? [];
    const refused = owners
        .map((owner) => (owner === undefined ? undefined : lookup.rules[owner]?.name))
        .filter((name) => name !== undefined)
        .filter((name) => !allowed.includes(name));
    return refused.length === 0 ? undefined : `${IMPORT_RULE_CATEGORY}${String(refused[0])}`;
}

async function validateFileImports(
    session: Session,

    lookup: RuleLookup,
    source: { path: string; grammar: 'python' | 'swift' },
    listImports: (root: Node) => ImportOwners[],
): Promise<CheckFinding[]> {
    const from = lookup.findOwner(source.path);
    if (from === undefined) return [];
    using tree = await parseSource(source.grammar, read(session.cache, source.path));
    return listImports(tree.rootNode).flatMap(({ node, module, owners }) => {
        const owner = findRefusedOwner(lookup, from, owners);
        if (owner === undefined) return [];
        const message = formatRefusedImport(lookup.allowed[from] ?? [], module, owner);
        return [
            {
                file: source.path,
                line: node.startPosition.row + 1,
                column: node.startPosition.column + 1,
                rule: RULES.refusedImport,
                message: message,
            },
        ];
    });
}

function buildPythonSearch(session: Session, planned: PlannedCheck): PythonSearch {
    const { settings, path: scopePath } = planned.scope;
    const python = getTable(settings, 'python');
    return {
        files: new Set(session.repository.files.map((file) => file.path)),
        roots: [...PYTHON_SOURCE_ROOTS, ...python.import_folders]
            .map((root) => posix.join(scopePath, root))
            .map((root) => (root === '.' ? '' : root)),
        externals: new Set(python.externals),
    };
}

async function validatePythonImports(
    session: Session,
    planned: PlannedCheck,
    lookup: RuleLookup,
): Promise<CheckFinding[]> {
    if (!planned.scope.settings.configurations.includes(PYTHON_CONFIGURATION)) return [];
    const search = buildPythonSearch(session, planned);
    const files = planned.files.filter(
        ({ path, kind }) => kind === 'source' && PYTHON_EXTENSIONS.some((extension) => path.endsWith(extension)),
    );
    const findings = await Promise.all(
        files.map(({ path }) =>
            validateFileImports(session, lookup, { path, grammar: 'python' }, (root) =>
                listPythonImports(root, path, search).map(({ node, module, path: target }) => ({
                    node,
                    module,
                    owners: [lookup.findOwner(target)],
                })),
            ),
        ),
    );
    return findings.flat();
}

function listSwiftImports(syntaxRoot: Node, path: string, modules: SwiftModule[], lookup: RuleLookup): ImportOwners[] {
    const own = new Set(modules.filter((module) => module.files.includes(path)).map(({ name }) => name));
    return syntaxRoot.descendantsOfType(SWIFT_IMPORT_NODE).flatMap((node) => {
        const name = findImportedModule(node);
        const module = modules.find((each) => each.name === name);
        return module === undefined || own.has(module.name)
            ? []
            : { node, module: module.name, owners: module.files.map((file) => lookup.findOwner(file)) };
    });
}

async function validateSwiftImports(
    session: Session,
    planned: PlannedCheck,
    lookup: RuleLookup,
): Promise<CheckFinding[]> {
    const files = planned.files.filter(({ path, kind }) => kind === 'source' && path.endsWith(SWIFT_EXTENSION));
    if (!planned.scope.settings.configurations.includes(SWIFT_CONFIGURATION) || files.length === 0) return [];
    const modules = await listSwiftModules(session);
    const findings = await Promise.all(
        files.map(({ path }) =>
            validateFileImports(session, lookup, { path, grammar: 'swift' }, (root) =>
                listSwiftImports(root, path, modules, lookup),
            ),
        ),
    );
    return findings.flat();
}

/**
Applies [[import_rule]] to Python and Swift imports, and reports the code files of every language that no rule covers.
ESLint applies the rules to JavaScript and TypeScript imports.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export async function checkImportRules(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const rules = session.settings.import_rule;
    if (rules.length === 0) throw new GspotError('skip', IMPORT_RULES_SKIP);
    const lookup = buildRuleLookup(rules);
    return [
        ...listUncoveredFiles(planned, lookup),
        ...(await validatePythonImports(session, planned, lookup)),
        ...(await validateSwiftImports(session, planned, lookup)),
    ];
}

function findModuleFile(folder: string, dotted: string, files: ReadonlySet<string>): string | undefined {
    const base = posix.join(folder, ...dotted.split('.').filter((segment) => segment !== ''));
    return PYTHON_MODULE_SUFFIXES.map((suffix) => `${base}${suffix}`).find((path) => files.has(path));
}

function findAbsoluteModule(dotted: string, search: PythonSearch): string | undefined {
    for (const root of search.roots) {
        const found = findModuleFile(root, dotted, search.files);
        if (found !== undefined) return found;
    }
    return undefined;
}

function listImportedNames(node: Node): (string | undefined)[] {
    const names = node
        .childrenForFieldName('name')
        .map((nameNode) =>
            nameNode.type === 'aliased_import' ? (nameNode.childForFieldName('name')?.text ?? '') : nameNode.text,
        );
    return names.length === 0 ? [undefined] : names;
}

function listAbsoluteImports(node: Node, module: string, search: PythonSearch): LocatedImport[] {
    return listImportedNames(node).flatMap((name) => {
        if (name !== undefined) {
            const inner = [module, name].join('.');
            const innerPath = findAbsoluteModule(inner, search);
            if (innerPath !== undefined) return [{ node, module: inner, path: innerPath }];
        }
        const path = findAbsoluteModule(module, search);
        return path === undefined ? [] : [{ node, module, path }];
    });
}

function listRelativeImports(node: Node, prefix: Node, file: string, search: PythonSearch): LocatedImport[] {
    const dots = prefix.namedChildren.find((child) => child.type === 'import_prefix')?.text.length ?? 1;
    const dotted = prefix.namedChildren.find((child) => child.type === 'dotted_name')?.text ?? '';
    const folder = posix.join(posix.dirname(file), ...Array.from({ length: dots - 1 }, () => '..'));
    return listImportedNames(node).flatMap((name) => {
        if (name !== undefined) {
            const innerPath = findModuleFile(folder, [dotted, name].filter(Boolean).join('.'), search.files);
            const module = prefix.text.endsWith('.') ? prefix.text + name : [prefix.text, name].join('.');
            if (innerPath !== undefined) return [{ node, module, path: innerPath }];
        }
        const path = findModuleFile(folder, dotted, search.files);
        return path === undefined ? [] : [{ node, module: prefix.text, path }];
    });
}

function listPythonImports(syntaxRoot: Node, file: string, search: PythonSearch): LocatedImport[] {
    return syntaxRoot.descendantsOfType([PYTHON_IMPORT_STATEMENT, PYTHON_FROM_STATEMENT]).flatMap((node) => {
        if (node.type === PYTHON_IMPORT_STATEMENT)
            return listImportedNames(node).flatMap((module) => {
                if (module === undefined || search.externals.has(module.split('.', 1)[0] ?? '')) return [];
                const path = findAbsoluteModule(module, search);
                return path === undefined ? [] : [{ node, module, path }];
            });
        const source = node.childForFieldName('module_name');
        if (source === null) return [];
        if (source.type === RELATIVE_IMPORT) return listRelativeImports(node, source, file, search);
        return search.externals.has(source.text.split('.', 1)[0] ?? '')
            ? []
            : listAbsoluteImports(node, source.text, search);
    });
}
