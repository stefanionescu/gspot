import type { Node } from 'web-tree-sitter';
import { isDocstring } from '#cli/parsers/python.ts';
import type { Session } from '#cli/types/session.ts';
import { getLimit } from '#cli/settings/scope-view.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseCached } from '#cli/system/files/cache.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { getNodePlace, buildFinding } from '#cli/runs/finding.ts';
import { PARSED_SOURCES } from '#cli/checks/structure/parsed-sources.ts';
import type { IsSubstantial, ParsedLanguage } from '#cli/types/checks/structure.ts';
import { checkExportedFunctions } from '#cli/checks/structure/exported-functions.ts';
import { isInterfaceClass, isPythonInterface } from '#cli/checks/structure/interfaces.ts';

import {
    BARE_NAME_NODES,
    CONTAINER_NODES,
    CONTAINER_NOISE,
    TYPE_ALIAS_NODES,
    BASH_COMMAND_NODES,
    SWIFT_ACCESSOR_NODES,
    BASH_SOURCE_COMMANDS,
    TYPE_REFERENCE_NODES,
    SWIFT_FUNCTION_LABELS,
    SWIFT_ACCESSOR_OWNERS,
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

function isSubstantialFunction(node: Node, language: ParsedLanguage, limit: number): boolean {
    if (node.type === 'lambda') return false;
    if (node.type === 'computed_property' && !node.namedChildren.some((child) => child.type === 'statements'))
        return node.namedChildren.some((child) => isSubstantial(child, language, limit));
    const body = node.childForFieldName('body') ?? node;
    const siblings = body.namedChildren;
    const children = siblings.filter((child) => !(language === 'python' && isDocstring(child, siblings)));
    return countExecutableStatements(children, language) > limit;
}

// Whether an assignment does more than forward a name: it declares a type, or it holds a substantial value.
function isSubstantialAssignment(node: Node, language: ParsedLanguage, limit: number): boolean {
    if (node.childForFieldName('left')?.text === '__all__') return false;
    const value = node.childForFieldName('right');
    return node.childForFieldName('type') !== null || (value !== null && isSubstantial(value, language, limit));
}

// An alias counts as substantial when its value does more than name an existing type.
function isNonReferenceAlias(node: Node): boolean {
    const value = node.childForFieldName('value') ?? node.namedChildren.at(-1);
    return value !== undefined && !TYPE_REFERENCE_NODES.has(value.type);
}

// What each node type must hold to count as substantial.
const SUBSTANCE: Record<string, IsSubstantial> = {
    expression_statement: (node, language, limit) => {
        const child = node.namedChildren[0];
        return child !== undefined && child.type !== 'string' && isSubstantial(child, language, limit);
    },
    assignment: isSubstantialAssignment,
    property_declaration: (node, language, limit) => {
        const computed = node.childForFieldName('computed_value');
        return computed === null || isSubstantial(computed, language, limit);
    },
    type_alias_statement: isNonReferenceAlias,
    typealias_declaration: isNonReferenceAlias,
};

// The node kinds one language reads differently from the others.
const LANGUAGE_SUBSTANCE: Record<ParsedLanguage, Record<string, IsSubstantial>> = {
    bash: {
        command: (node: Node): boolean => {
            const name = node.childForFieldName('name')?.text;
            return !BASH_SOURCE_COMMANDS.has(name ?? '');
        },
    },
    python: {
        class_definition: (node, language, limit) =>
            isInterfaceClass(node) || isSubstantialContainer(node, language, limit),
    },
    swift: {},
};

function isInert(node: Node): boolean {
    if (node.type.includes('comment') || node.type.startsWith('import')) return true;
    return node.type === 'hash_bang_line' || BARE_NAME_NODES.has(node.type);
}

function isSubstantialContainer(node: Node, language: ParsedLanguage, limit: number): boolean {
    const body = node.childForFieldName('body');
    return (body?.namedChildren ?? node.namedChildren)
        .filter((child) => !CONTAINER_NOISE.has(child.type))
        .some((child) => isSubstantial(child, language, limit));
}

function isSubstantial(node: Node, language: ParsedLanguage, limit: number): boolean {
    if (isInert(node)) return false;
    const languageSubstance = LANGUAGE_SUBSTANCE[language][node.type];
    if (languageSubstance !== undefined) return languageSubstance(node, language, limit);
    if (COUNTED_FUNCTION_NODES.has(node.type)) return isSubstantialFunction(node, language, limit);
    if (CONTAINER_NODES.has(node.type)) return isSubstantialContainer(node, language, limit);
    const substance = SUBSTANCE[node.type];
    return substance === undefined ? true : substance(node, language, limit);
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
 * Checks whether a file holds only imports, aliases, forwarding statements, or trivial functions.
 *
 * @param syntaxRoot the parsed file.
 * @param language the grammar of the file.
 * @param limit the most statements a trivial function holds.
 * @returns whether the file holds nothing substantial.
 */
function isTrivialFile(syntaxRoot: Node, language: ParsedLanguage, limit: number): boolean {
    const siblings = syntaxRoot.namedChildren;
    const statements = siblings.filter(
        (node) => !node.type.includes('comment') && !(language === 'python' && isDocstring(node, siblings)),
    );
    return statements.length > 0 && !statements.some((child) => isSubstantial(child, language, limit));
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
 * Formats the message for a function at or under the statement limit.
 *
 * @param name what to call the function.
 * @param count the executable statements it holds.
 * @param limit the most statements that still count as trivial.
 * @returns the message.
 */
function formatTrivialFunction(name: string, count: number, limit: number): string {
    const statements = count === 1 ? '1 statement' : `${String(count)} statements`;
    return `${name} has ${statements}. Functions with ${String(limit)} or fewer are reported. Inline it into its callers, or record the API it serves with gspot ignore.`;
}

/**
 * Reports trivial functions and files, and leaves anonymous functions alone.
 *
 * @param session the repository and its tools.
 * @param planned the scope files and statement limits.
 * @returns the findings.
 */
export async function checkStructureTrivialFunctions(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const parsed = await parseCached(
        { ...session, files: planned.files, selection: planned.selection },
        PARSED_SOURCES,
    );
    const files: Finding[] = [];
    const functions = parsed.flatMap((source) => {
        const limit = getLimit(planned.selection.view, 'trivial_function_statements', source.language);
        const findings = (source.captures.get('function') ?? []).flatMap((node) => {
            const body = extractFunctionBody(node, source.language);
            const count = countExecutableStatements(body, source.language);
            if (count > limit || (source.language === 'python' && isPythonInterface(node))) return [];
            const name =
                source.language === 'swift'
                    ? formatSwiftFunctionName(node)
                    : (node.childForFieldName('name')?.text ?? 'function');
            const message = formatTrivialFunction(name, count, limit);
            return [{ ...buildFinding(planned, getNodePlace(source.path, node), 'trivial-function', message), name }];
        });
        if (isTrivialFile(source.tree.rootNode, source.language, limit)) {
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
                    'This file contains only imports, aliases, forwarding, or trivial functions. Move them to the code that uses them.',
                ),
            );
        }
        return findings;
    });
    return [...checkExportedFunctions(session, planned), ...functions, ...files];
}
