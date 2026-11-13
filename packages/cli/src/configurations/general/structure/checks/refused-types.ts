import { posix } from 'node:path';

import type { Node } from 'web-tree-sitter';

import { IMPORT_RULE_CATEGORY } from '#cli/config/configurations/shared.ts';
import {
    CAPITALIZED_NAME,
    DECLARATION_NODES,
    IMPORT_RULE_CHECK_RULES,
    MEMBER_DOT,
    NON_USE_PARENTS,
    USE_NODES,
} from '#cli/config/configurations/structure.ts';
import { SWIFT_EXTENSION } from '#cli/config/parsers/code.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/projects.ts';
import { formatRefusedImport } from '#cli/configurations/import-rules.ts';
import { visitParsedSources } from '#cli/parsers/code/grammars.ts';
import { isPrivateSwiftDeclaration } from '#cli/parsers/code/swift.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import type { RuleLookup, SwiftDeclarations } from '#cli/types/configurations/general.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/run.ts';
import type { SourceTree } from '#cli/types/parsers.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { ImportRule } from '#cli/types/settings.ts';
import type { Session } from '#cli/types/tools.ts';

function listRuleSwiftFiles(files: TrackedFile[], lookup: RuleLookup): Array<{ path: string; grammar: 'swift' }> {
    return files
        .filter(
            ({ path, kind }) =>
                kind === 'source' &&
                path.endsWith(SWIFT_EXTENSION) &&
                posix.basename(path) !== PACKAGE_SWIFT &&
                lookup.findOwner(path) !== undefined,
        )
        .map(({ path }) => ({ path, grammar: 'swift' }));
}

function addToSet(table: Map<string, Set<string>>, key: string, value: string): void {
    table.set(key, (table.get(key) ?? new Set()).add(value));
}

async function readDeclarations(
    session: Session,
    planned: PlannedCheck,
    lookup: RuleLookup,
): Promise<SwiftDeclarations> {
    const declarations: SwiftDeclarations = { owners: new Map(), hidden: new Map() };
    const files = listRuleSwiftFiles(session.repository.files, lookup);
    const isTest = buildPathMatcher(planned.scope.settings.test_files);
    await visitParsedSources({ cache: session.cache, resources: session.resources, files }, ({ path, rootNode }) => {
        const { name: rule } = lookup.rules[lookup.findOwner(path) as number] as ImportRule;
        const sharedTopLevel = new Set(
            rootNode.namedChildren.filter((child) => !isPrivateSwiftDeclaration(child)).map((child) => child.id),
        );
        for (const node of rootNode.descendantsOfType(DECLARATION_NODES)) {
            const name = node.type === 'type_parameter' ? node.firstNamedChild : node.childForFieldName('name');
            if (name?.type !== 'type_identifier') continue;
            if (!isTest(path) && sharedTopLevel.has(node.id)) addToSet(declarations.owners, name.text, rule);
            else addToSet(declarations.hidden, rule, name.text);
        }
    });
    return declarations;
}

function findRefusedOwner(name: string, allowed: string[], declarations: SwiftDeclarations): string | undefined {
    const owners = declarations.owners.get(name);
    if (owners?.size !== 1) return undefined;
    const [owner] = owners;
    if (owner === undefined || allowed.includes(owner)) return undefined;
    return allowed.some((rule) => declarations.hidden.get(rule)?.has(name) === true) ? undefined : owner;
}

function isTypeUse(node: Node): boolean {
    const parent = node.parent;
    if (parent === null) return false;
    if (node.type === 'type_identifier') return parent.firstNamedChild?.id === node.id;
    if (!CAPITALIZED_NAME.test(node.text) || NON_USE_PARENTS.has(parent.type)) return false;
    return node.previousSibling?.type !== MEMBER_DOT;
}

function listRefusedUses(
    { path, rootNode }: Pick<SourceTree, 'path' | 'rootNode'>,
    lookup: RuleLookup,
    declarations: SwiftDeclarations,
): CheckFinding[] {
    const allowed = lookup.allowed[lookup.findOwner(path) as number] ?? [];
    const findings = new Map<string, CheckFinding>();
    for (const node of rootNode.descendantsOfType(USE_NODES)) {
        const name = node.text;
        const owner = findings.has(name) ? undefined : findRefusedOwner(name, allowed, declarations);
        if (owner === undefined || !isTypeUse(node)) continue;
        findings.set(name, {
            file: path,
            line: node.startPosition.row + 1,
            column: node.startPosition.column + 1,
            rule: IMPORT_RULE_CHECK_RULES.refusedImport,
            message: formatRefusedImport(allowed, name, `${IMPORT_RULE_CATEGORY}${owner}`),
        });
    }
    return findings.values().toArray();
}

/**
Report each Swift type that a file uses from a rule that its own rule may not import. Files of one target use each
other with no import line, so this matches names: the first use of a name in each file, when exactly one rule declares
that name as a type that other files can read.

@param planned the files to report on, and the test files, whose types no other file reads.
*/
export async function listRefusedSwiftTypes(
    session: Session,
    planned: PlannedCheck,
    lookup: RuleLookup,
): Promise<CheckFinding[]> {
    const declarations = await readDeclarations(session, planned, lookup);
    const findings: CheckFinding[] = [];
    const files = listRuleSwiftFiles(planned.files, lookup);
    await visitParsedSources({ cache: session.cache, resources: session.resources, files }, (source) => {
        findings.push(...listRefusedUses(source, lookup, declarations));
    });
    return findings;
}
