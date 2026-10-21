import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { GspotError } from '#cli/system/errors.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { parseSource } from '#cli/parsers/grammars.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { getImportedModule } from '#cli/parsers/swift.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { locateNode, buildFinding } from '#cli/runs/finding.ts';
import type { ImportRule } from '#cli/types/settings/imports.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { NODE_SHEBANG_TAG } from '#cli/config/repository/inventory.ts';
import { listSwiftModules } from '#cli/checks/structure/swift-modules.ts';
import { escapeGlob, buildPathMatcher } from '#cli/repository/matchers.ts';
import { listPythonImports } from '#cli/checks/structure/python-imports.ts';
import { SWIFT_EXTENSION, SWIFT_IMPORT_NODE } from '#cli/config/parsers/swift.ts';
import { listAllowedRules, formatRefusedImport } from '#cli/settings/import-rules.ts';
import { SWIFT_CONFIGURATION, PYTHON_CONFIGURATION } from '#cli/config/configurations.ts';
import { MISE_SCRIPT_PATH, IMPORT_RULE_CATEGORY } from '#cli/config/generation/eslint.ts';
import type { RuleLookup, SwiftModule, PythonSearch, ImportOwners } from '#cli/types/checks/import-rules.ts';

import {
    IMPORT_RULES_SKIP,
    PYTHON_EXTENSIONS,
    PYTHON_SOURCE_ROOTS,
    TOOL_SETTINGS_FILES,
    IMPORT_RULE_EXTENSIONS,
    UNCOVERED_FILE_MESSAGE,
} from '#cli/config/checks/import-rules.ts';

function buildRuleLookup(rules: ImportRule[]): RuleLookup {
    const matchers = rules.map((rule) => buildPathMatcher(rule.paths));
    return {
        rules,
        ownerOf: (path) => {
            const index = matchers.findIndex((matches) => matches(path));
            return index === -1 ? undefined : index;
        },
        allowed: rules.map((_rule, index) => listAllowedRules(rules, index)),
    };
}

function buildExemption(planned: PlannedCheck): (file: TrackedFile) => boolean {
    const { view, scope } = planned.selection;
    const matches = buildPathMatcher([
        ...view.test_files,
        ...TOOL_SETTINGS_FILES,
        ...(view.values.javascript?.script_files ?? []),
        joinScope(escapeGlob(scope.path), MISE_SCRIPT_PATH),
    ]);
    return (file) => matches(file.path) || file.tags.includes(NODE_SHEBANG_TAG);
}

function listUncoveredFiles(planned: PlannedCheck, lookup: RuleLookup): Finding[] {
    const isExempt = buildExemption(planned);
    return planned.files
        .filter(
            (file) =>
                file.kind === 'source' &&
                IMPORT_RULE_EXTENSIONS.some((extension) => file.path.endsWith(extension)) &&
                !isExempt(file) &&
                lookup.ownerOf(file.path) === undefined,
        )
        .map((file) => buildFinding(planned, { file: file.path, line: 1 }, 'uncovered-file', UNCOVERED_FILE_MESSAGE));
}

function findRefusedOwner(lookup: RuleLookup, from: number, owners: (number | undefined)[]): string | undefined {
    const allowed = lookup.allowed[from] ?? [];
    const refused = owners
        .map((owner) => (owner === undefined ? undefined : lookup.rules[owner]?.name))
        .filter((name) => name !== undefined)
        .filter((name) => !allowed.includes(name));
    return refused.length === 0 ? undefined : `${IMPORT_RULE_CATEGORY}${String(refused[0])}`;
}

async function checkFileImports(
    session: Session,
    planned: PlannedCheck,
    lookup: RuleLookup,
    source: { path: string; grammar: 'python' | 'swift' },
    listImports: (root: Node) => ImportOwners[],
): Promise<Finding[]> {
    const from = lookup.ownerOf(source.path);
    if (from === undefined) return [];
    const tree = await parseSource(source.grammar, readCachedText(session.reads, source.path));
    try {
        return listImports(tree.rootNode).flatMap(({ node, module, owners }) => {
            const owner = findRefusedOwner(lookup, from, owners);
            if (owner === undefined) return [];
            const message = formatRefusedImport(lookup.allowed[from] ?? [], module, owner);
            return [buildFinding(planned, locateNode(source.path, node), 'refused-import', message)];
        });
    } finally {
        tree.delete();
    }
}

function buildPythonSearch(session: Session, planned: PlannedCheck): PythonSearch {
    const { view, scope } = planned.selection;
    const python = view.values.python;
    return {
        files: new Set(session.repository.files.map((file) => file.path)),
        roots: [...PYTHON_SOURCE_ROOTS, ...(python?.extra_paths ?? [])]
            .map((root) => posix.join(scope.path, root))
            .map((root) => (root === '.' ? '' : root)),
        externals: new Set(python?.externals),
    };
}

async function checkPythonImports(session: Session, planned: PlannedCheck, lookup: RuleLookup): Promise<Finding[]> {
    if (!planned.selection.view.configurations.includes(PYTHON_CONFIGURATION)) return [];
    const search = buildPythonSearch(session, planned);
    const files = planned.files.filter(({ path }) => PYTHON_EXTENSIONS.some((extension) => path.endsWith(extension)));
    const findings = await Promise.all(
        files.map(({ path }) =>
            checkFileImports(session, planned, lookup, { path, grammar: 'python' }, (root) =>
                listPythonImports(root, path, search).map(({ node, module, target }) => ({
                    node,
                    module,
                    owners: [lookup.ownerOf(target)],
                })),
            ),
        ),
    );
    return findings.flat();
}

function listSwiftImports(root: Node, path: string, modules: SwiftModule[], lookup: RuleLookup): ImportOwners[] {
    const own = new Set(modules.filter((module) => module.files.includes(path)).map(({ name }) => name));
    return root.descendantsOfType(SWIFT_IMPORT_NODE).flatMap((node) => {
        const name = getImportedModule(node);
        const module = modules.find((entry) => entry.name === name);
        if (module === undefined || own.has(module.name)) return [];
        return [{ node, module: module.name, owners: module.files.map((file) => lookup.ownerOf(file)) }];
    });
}

async function checkSwiftImports(session: Session, planned: PlannedCheck, lookup: RuleLookup): Promise<Finding[]> {
    const files = planned.files.filter(({ path }) => path.endsWith(SWIFT_EXTENSION));
    if (!planned.selection.view.configurations.includes(SWIFT_CONFIGURATION) || files.length === 0) return [];
    const modules = await listSwiftModules(session);
    const findings = await Promise.all(
        files.map(({ path }) =>
            checkFileImports(session, planned, lookup, { path, grammar: 'swift' }, (root) =>
                listSwiftImports(root, path, modules, lookup),
            ),
        ),
    );
    return findings.flat();
}

/**
 * Applies [[import_rule]] to Python and Swift imports, and reports the code files of every language that no rule covers.
 * ESLint applies the rules to JavaScript and TypeScript imports.
 *
 * @param session the repository and its tools.
 * @param planned the scope files, the repository files, and the settings.
 * @returns a finding for each refused import and each uncovered file.
 */
export async function checkImportRules(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const rules = session.settingsFile.settings.import_rule;
    if (rules.length === 0) throw new GspotError('skip', IMPORT_RULES_SKIP);
    const lookup = buildRuleLookup(rules);
    return [
        ...listUncoveredFiles(planned, lookup),
        ...(await checkPythonImports(session, planned, lookup)),
        ...(await checkSwiftImports(session, planned, lookup)),
    ];
}
