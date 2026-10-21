import type { Node } from 'web-tree-sitter';
import { isDocstring } from '#cli/parsers/python.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseCached } from '#cli/system/files/cache.ts';
import { getLimit } from '#cli/settings/scope-settings.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildFinding, getNodePlace } from '#cli/runs/finding.ts';
import type { ParsedLanguage } from '#cli/types/checks/structure.ts';
import { PARSED_SOURCES } from '#cli/checks/structure/parsed-sources.ts';

import {
    BARE_NAME_NODES,
    FORWARDING_NODES,
    TYPE_ALIAS_NODES,
    PYTHON_EXPORT_LIST,
    BASH_COMMAND_NODES,
    BASH_SOURCE_COMMANDS,
    SWIFT_ACCESSOR_NODES,
    TYPE_REFERENCE_NODES,
    SWIFT_ACCESSOR_OWNERS,
    SWIFT_FUNCTION_LABELS,
    COUNTED_FUNCTION_NODES,
} from '#cli/config/checks/structure.ts';

// Executable bodies exclude Python docstrings and Swift declarations without bodies.
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

// How many executable statements one node counts as in each language, before counting its children.
const STATEMENT_COUNTS: Record<ParsedLanguage, (node: Node) => number> = {
    swift: (node) => (node.parent?.type === 'statements' ? 1 : 0),
    python: (node) => {
        const isClass = node.type === 'class_definition';
        const isStatement = node.type.endsWith('_statement') && node.type !== 'decorated_definition';
        return Number(isClass) + Number(isStatement);
    },
    bash: (node) => (isBashStatement(node) ? 1 : 0),
};

// A Python alias assigns a bare name or attribute, and `__all__` lists the names that the module re-exports.
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

// The statements that forward code in one language: a Python alias, or a Bash command that sources another script.
const LANGUAGE_FORWARDING: Record<ParsedLanguage, (node: Node) => boolean> = {
    python: isPythonAlias,
    swift: () => false,
    bash: (node) => node.type === 'command' && BASH_SOURCE_COMMANDS.has(node.childForFieldName('name')?.text ?? ''),
};

// Imports, re-exports, and aliases forward code that another module owns.
function isForwarding(node: Node, language: ParsedLanguage): boolean {
    if (FORWARDING_NODES.has(node.type) || node.type.startsWith('import')) return true;
    // A type alias forwards when it names an existing type and declares nothing of its own.
    if (TYPE_ALIAS_NODES.has(node.type))
        return TYPE_REFERENCE_NODES.has((node.childForFieldName('value') ?? node.namedChildren.at(-1))?.type ?? '');
    return LANGUAGE_FORWARDING[language](node);
}

/**
 * Count executable statements, including nested function and callback bodies, without type-only declarations.
 *
 * @param nodes the body to count.
 * @param language the grammar of the file.
 * @returns the count, including one for each expression-bodied lambda.
 */
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

/**
 * Checks whether a file only forwards code: each statement imports, re-exports, or renames.
 *
 * @param syntaxRoot the parsed file.
 * @param language the grammar of the file.
 * @returns whether the file holds nothing but forwarding statements.
 */
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

/**
 * Names a Swift function, or an accessor or observer with its declaration.
 *
 * @param node the Swift function or accessor.
 * @returns the label for the finding.
 */
function formatSwiftFunctionName(node: Node): string {
    const name = node.childForFieldName('name')?.text ?? SWIFT_FUNCTION_LABELS[node.type] ?? 'function';
    return SWIFT_ACCESSOR_NODES.has(node.type) ? formatAccessorName(node, name) : name;
}

/**
 * Reports each named function at or under the statement limit, and each file that only forwards code. Anonymous
 * functions have no name, so the check leaves them out.
 *
 * @param session the repository and its tools.
 * @param planned the scope files and statement limits.
 * @returns the findings.
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
