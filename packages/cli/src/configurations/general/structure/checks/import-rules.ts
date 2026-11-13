import { posix } from 'node:path';

import type { Node } from 'web-tree-sitter';

import { ESLINT_SETTINGS_TABLE, IMPORT_RULE_CATEGORY, NODE_SHEBANG_TAG } from '#cli/config/configurations/shared.ts';
import {
    CONFIG_PATTERNS,
    IMPORT_RULE_CHECK_RULES,
    IMPORT_RULE_EXTENSIONS,
    PYTHON_SOURCE_ROOTS,
    UNCOVERED_FILE_MESSAGE,
} from '#cli/config/configurations/structure.ts';
import { PYTHON_EXTENSIONS, SWIFT_EXTENSION, SWIFT_IMPORT_NODE } from '#cli/config/parsers/code.ts';
import { PYTHON_CONFIGURATION, SWIFT_CONFIGURATION } from '#cli/config/settings/detected.ts';
import { listRefusedSwiftTypes } from '#cli/configurations/general/structure/checks/refused-types.ts';
import { listSwiftModules } from '#cli/configurations/general/structure/checks/swift-modules.ts';
import { IMPORT_EXPLANATIONS } from '#cli/configurations/general/structure/explanations.ts';
import { formatRefusedImport, listAllowedRules } from '#cli/configurations/import-rules.ts';
import { listScriptFiles } from '#cli/configurations/language/javascript/sources.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { listPythonImports } from '#cli/parsers/code/python.ts';
import { findImportedModule } from '#cli/parsers/code/swift.ts';
import { getTable } from '#cli/settings/tables.ts';
import { readText } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import type { ImportOwners, RuleLookup } from '#cli/types/configurations/structure.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { PythonSearch, SwiftModule } from '#cli/types/parsers.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { ImportRule } from '#cli/types/settings.ts';
import type { Session } from '#cli/types/tools.ts';

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
    const { settings } = planned.scope;
    const isExemptPath = buildPathMatcher([
        ...settings.test_files,
        ...CONFIG_PATTERNS,
        ...[
            ...(settings.tables[ESLINT_SETTINGS_TABLE]?.plugins ?? []),
            ...(settings.tables['tools.stylelint']?.plugins ?? []),
        ].flatMap((plugin) => plugin.path ?? []),
        ...listScriptFiles(planned.scope),
    ]);
    return (file) => isExemptPath(file.path) || file.tags.includes(NODE_SHEBANG_TAG);
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
            rule: IMPORT_RULE_CHECK_RULES.uncoveredFile,
            message: UNCOVERED_FILE_MESSAGE,
        }));
}

function findRefusedOwner(lookup: RuleLookup, from: number, owners: Array<number | undefined>): string | undefined {
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
    using tree = await parseSource(source.grammar, readText(session.cache, source.path), session);
    return listImports(tree.rootNode).flatMap(({ node, module, owners }) => {
        const owner = findRefusedOwner(lookup, from, owners);
        if (owner === undefined) return [];
        const message = formatRefusedImport(lookup.allowed[from] ?? [], module, owner);
        return [
            {
                file: source.path,
                line: node.startPosition.row + 1,
                column: node.startPosition.column + 1,
                rule: IMPORT_RULE_CHECK_RULES.refusedImport,
                message,
            },
        ];
    });
}

function buildPythonSearch(session: Session, planned: PlannedCheck): PythonSearch {
    const { settings, path: scopePath } = planned.scope;
    const python = getTable(settings, 'python');
    return {
        files: new Set(session.repository.files.map((file) => file.path)),
        roots: [...PYTHON_SOURCE_ROOTS.map((root) => posix.join(scopePath, root)), ...python.import_folders].map(
            (root) => (root === '.' ? '' : root),
        ),
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
    return [...findings.flat(), ...(await listRefusedSwiftTypes(session, planned, lookup))];
}

/**
Applies [[import_rule]] to Python and Swift imports and to the types that Swift files name, and reports the code files
of every language that no rule covers. ESLint applies the rules to JavaScript and TypeScript imports.
*/
async function checkImportRules(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const lookup = buildRuleLookup(session.settings.import_rule);
    const python = await validatePythonImports(session, planned, lookup);
    const swift = await validateSwiftImports(session, planned, lookup);
    return [...listUncoveredFiles(planned, lookup), ...python, ...swift];
}

export const STRUCTURE_IMPORT_RULES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'structure/import-rules': { check: checkImportRules, explanations: IMPORT_EXPLANATIONS },
};
