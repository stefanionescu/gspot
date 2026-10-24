import type { Node } from 'web-tree-sitter';
import { getLimit } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseCached } from '#cli/system/files/cache.ts';
import { isDocstring } from '#cli/parsers/code/python.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildFinding, getNodePlace } from '#cli/runs/finding.ts';
import type { ParsedLanguage } from '#cli/types/checks/general/structure.ts';
import { PARSED_SOURCES } from '#cli/checks/general/structure/parsed-sources.ts';

import {
    BARE_NAME_NODES,
    TYPE_ALIAS_NODES,
    FORWARDING_NODES,
    PYTHON_EXPORT_LIST,
    BASH_COMMAND_NODES,
    SWIFT_ACCESSOR_NODES,
    TYPE_REFERENCE_NODES,
    BASH_SOURCE_COMMANDS,
    SWIFT_FUNCTION_LABELS,
    SWIFT_ACCESSOR_OWNERS,
    COUNTED_FUNCTION_NODES,
} from '#cli/config/checks/general/structure/trivial-functions.ts';

function extractFunctionBody(node: Node, language: ParsedLanguage): Node[] {
    const body = node.childForFieldName('body') ?? node;
    const siblings =
        language === 'swift'
            ? (body.namedChildren.find((child) => child.type === 'statements')?.namedChildren ?? [])
            : body.namedChildren;
    return siblings.filter(
        (child) => !child.type.includes('comment') && !(language === 'python' && isDocstring(child, siblings)),
    );
}

function isBashStatement(node: Node): boolean {
    if (BASH_COMMAND_NODES.has(node.type)) return true;
    if (node.type === 'variable_assignment') return !BASH_COMMAND_NODES.has(node.parent?.type ?? '');
    return node.type.endsWith('_statement') && node.type !== 'compound_statement';
}

const STATEMENT_COUNTS: Record<ParsedLanguage, (node: Node) => number> = {
    swift: (node) => (node.parent?.type === 'statements' ? 1 : 0),
    python: (node) => {
        const isClass = node.type === 'class_definition';
        const isStatement = node.type.endsWith('_statement') && node.type !== 'decorated_definition';
        return Number(isClass) + Number(isStatement);
    },
    bash: (node) => (isBashStatement(node) ? 1 : 0),
};

function isPythonAlias(node: Node): boolean {
    const assignment = node.namedChildren[0];
    if (node.type !== 'expression_statement' || assignment?.type !== 'assignment') return false;
    if (assignment.childForFieldName('type') !== null) return false;
    const value = assignment.childForFieldName('right');
    return (
        assignment.childForFieldName('left')?.text === PYTHON_EXPORT_LIST ||
        (value !== null && BARE_NAME_NODES.has(value.type))
    );
}

const LANGUAGE_FORWARDING: Record<ParsedLanguage, (node: Node) => boolean> = {
    python: isPythonAlias,
    swift: () => false,
    bash: (node) => node.type === 'command' && BASH_SOURCE_COMMANDS.has(node.childForFieldName('name')?.text ?? ''),
};

function isForwarding(node: Node, language: ParsedLanguage): boolean {
    if (FORWARDING_NODES.has(node.type) || node.type.startsWith('import')) return true;
    if (TYPE_ALIAS_NODES.has(node.type))
        return TYPE_REFERENCE_NODES.has((node.childForFieldName('value') ?? node.namedChildren.at(-1))?.type ?? '');
    return LANGUAGE_FORWARDING[language](node);
}

function countExecutableStatements(nodes: Node[], language: ParsedLanguage): number {
    let count = 0;
    for (const node of nodes) {
        if (node.type.includes('comment') || TYPE_ALIAS_NODES.has(node.type)) continue;
        if (COUNTED_FUNCTION_NODES.has(node.type)) {
            const body = node.type === 'lambda' ? node.namedChildren : extractFunctionBody(node, language);
            count += Number(node.type === 'lambda') + countExecutableStatements(body, language);
            continue;
        }
        count += STATEMENT_COUNTS[language](node) + countExecutableStatements(node.namedChildren, language);
    }
    return count;
}

function isTrivialFile(syntaxRoot: Node, language: ParsedLanguage): boolean {
    const siblings = syntaxRoot.namedChildren;
    const statements = siblings.filter(
        (node) => !node.type.includes('comment') && !(language === 'python' && isDocstring(node, siblings)),
    );
    return statements.length > 0 && statements.every((node) => isForwarding(node, language));
}

function formatAccessorName(node: Node, label: string): string {
    let declaration = node.parent;
    while (declaration !== null) {
        const type = declaration.type;
        if (SWIFT_ACCESSOR_OWNERS.has(type)) break;
        declaration = declaration.parent;
    }
    if (declaration === null) return label;
    const name =
        declaration.type === 'subscript_declaration' ? 'subscript' : declaration.childForFieldName('name')?.text;
    return name === undefined ? label : `${label} of ${name}`;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Merged into formatAccessorName, it passes the complexity limit of 8.
function formatSwiftFunctionName(node: Node): string {
    const name = node.childForFieldName('name')?.text ?? SWIFT_FUNCTION_LABELS[node.type] ?? 'function';
    return SWIFT_ACCESSOR_NODES.has(node.type) ? formatAccessorName(node, name) : name;
}

/**
Reports each named function at or under the statement limit, and each file that only forwards code. Anonymous
functions have no name, so the check leaves them out.

@param session the repository and its tools.
@param planned the scope files and statement limits.
@returns the findings.
*/
export async function checkStructureTrivialFunctions(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const parsed = await parseCached({ ...session, files: planned.files, scope: planned.scope }, PARSED_SOURCES);
    const files: Finding[] = [];
    const functions = parsed.flatMap((source) => {
        const limit = getLimit(planned.scope.settings, 'trivial_function_statements', source.language);
        const findings = (source.captures.get('function') ?? []).flatMap((node) => {
            const body = extractFunctionBody(node, source.language);
            const count = countExecutableStatements(body, source.language);
            if (count > limit) return [];
            const name =
                source.language === 'swift'
                    ? formatSwiftFunctionName(node)
                    : (node.childForFieldName('name')?.text ?? 'function');
            const statements = count === 1 ? '1 statement' : `${String(count)} statements`;
            const message = `${name} has ${statements}. Functions with ${String(limit)} or fewer are reported. Inline it into its callers, or record the API it serves with gspot ignore.`;
            return [{ ...buildFinding(planned, getNodePlace(source.path, node), 'trivial-function', message), name }];
        });
        if (isTrivialFile(source.tree.rootNode, source.language)) {
            const line =
                source.language === 'bash'
                    ? 1
                    : (source.tree.rootNode.namedChildren.find((node) => !node.type.includes('comment'))?.startPosition
                          .row ?? 0) + 1;
            files.push(
                buildFinding(
                    planned,
                    { file: source.path, line },
                    'trivial-file',
                    'This file only imports, re-exports, or renames code. Import from the module that defines it, and delete this file.',
                ),
            );
        }
        return findings;
    });
    return [...functions, ...files];
}
