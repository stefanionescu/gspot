// Counting executable statements in Python, Swift, and Bash syntax trees, and telling a trivial file from a real one.
import type { Node } from 'web-tree-sitter';
import type { Language, Substance } from '#cli/types/checks.ts';

import {
    NAMES,
    FUNCTIONS,
    CONTAINERS,
    TYPE_ALIASES,
    CONTAINER_NOISE,
    TYPE_REFERENCES,
} from '#cli/config/checks/structure.ts';

// Whether a Bash node is one executable command or statement.
function isBashStatement(node: Node): boolean {
    if (node.type === 'command' || node.type === 'declaration_command') return true;
    if (node.type === 'variable_assignment')
        return node.parent?.type !== 'declaration_command' && node.parent?.type !== 'command';
    return node.type.endsWith('_statement') && node.type !== 'compound_statement';
}

// How many executable statements one node counts as in each language, before its children are counted.
const STATEMENT_COUNTS: Record<Language, (node: Node) => number> = {
    swift: (node) => (node.parent?.type === 'statements' ? 1 : 0),
    python: (node) => {
        const isClass = node.type === 'class_definition';
        const isStatement = node.type.endsWith('_statement') && node.type !== 'decorated_definition';
        return Number(isClass) + Number(isStatement);
    },
    bash: (node) => (isBashStatement(node) ? 1 : 0),
};

// Whether a function holds more executable statements than the trivial threshold, ignoring a Python docstring.
function isSubstantialFunction(node: Node, language: Language, threshold: number): boolean {
    if (node.type === 'lambda') return false;
    if (node.type === 'computed_property' && !node.namedChildren.some((child) => child.type === 'statements'))
        return node.namedChildren.some((child) => isSubstantial(child, language, threshold));
    const body = node.childForFieldName('body') ?? node;
    const children = body.namedChildren.filter((child, index) => {
        const isDocstring =
            index === 0 && child.type === 'expression_statement' && child.namedChildren[0]?.type === 'string';
        return !(language === 'python' && isDocstring);
    });
    return executableStatements(children, language) > threshold;
}

// Whether an assignment does more than forward a name: it declares a type, or its value is substantial.
function isSubstantialAssignment(node: Node, language: Language, threshold: number): boolean {
    if (node.childForFieldName('left')?.text === '__all__') return false;
    const value = node.childForFieldName('right');
    return node.childForFieldName('type') !== null || (value !== null && isSubstantial(value, language, threshold));
}
// What each kind of node must hold to count as substantial, by node type.
const SUBSTANCE: Record<string, Substance> = {
    expression_statement: (node, language, threshold) => {
        const child = node.namedChildren[0];
        return child !== undefined && child.type !== 'string' && isSubstantial(child, language, threshold);
    },
    assignment: isSubstantialAssignment,
    property_declaration: (node, language, threshold) => {
        const computed = node.childForFieldName('computed_value');
        return computed === null || isSubstantial(computed, language, threshold);
    },
    type_alias_statement: (node: Node): boolean => {
        const value = node.childForFieldName('value') ?? node.namedChildren.at(-1);
        return value !== undefined && !TYPE_REFERENCES.has(value.type);
    },
    typealias_declaration: (node: Node): boolean => {
        const value = node.childForFieldName('value') ?? node.namedChildren.at(-1);
        return value !== undefined && !TYPE_REFERENCES.has(value.type);
    },
};
// The node kinds one language reads differently from the others.
const LANGUAGE_SUBSTANCE: Record<Language, Record<string, Substance>> = {
    bash: {
        command: (node: Node): boolean => {
            const name = node.childForFieldName('name')?.text;
            return name !== 'source' && name !== '.';
        },
    },
    python: {},
    swift: {},
};

// Whether a node can never be substantial: a comment, an import, a shebang, or a bare name.
function isInert(node: Node): boolean {
    if (node.type.includes('comment') || node.type.startsWith('import')) return true;
    return node.type === 'hash_bang_line' || NAMES.has(node.type);
}

// Identify substantive nodes beyond imports, names, forwarding declarations, and trivial functions.
function isSubstantial(node: Node, language: Language, threshold: number): boolean {
    if (isInert(node)) return false;
    if (FUNCTIONS.has(node.type)) return isSubstantialFunction(node, language, threshold);
    if (CONTAINERS.has(node.type)) {
        const body = node.childForFieldName('body');
        return (body?.namedChildren ?? node.namedChildren)
            .filter((child) => !CONTAINER_NOISE.has(child.type))
            .some((child) => isSubstantial(child, language, threshold));
    }
    const substance = LANGUAGE_SUBSTANCE[language][node.type] ?? SUBSTANCE[node.type];
    return substance === undefined ? true : substance(node, language, threshold);
}

/**
 * Count executable statements, excluding nested function bodies and type-only declarations.
 * @param nodes the body nodes
 * @param language the language the nodes were parsed as
 * @returns the count
 */
export function executableStatements(nodes: Node[], language: Language): number {
    let count = 0;
    for (const node of nodes) {
        if (node.type.includes('comment') || TYPE_ALIASES.has(node.type)) continue;
        if (FUNCTIONS.has(node.type)) {
            if (!node.type.startsWith('lambda')) count += 1;
            continue;
        }
        count += STATEMENT_COUNTS[language](node) + executableStatements(node.namedChildren, language);
    }
    return count;
}

/**
 * Whether every declaration is an import, alias, forwarding statement, or trivial function.
 * @param root the file's syntax tree
 * @param language the language the file was parsed as
 * @param threshold the statement count at or under which a function is trivial
 * @returns whether the file holds nothing substantial
 */
export function trivialFile(root: Node, language: Language, threshold: number): boolean {
    const statements = root.namedChildren.filter((node, index) => {
        if (node.type.includes('comment')) return false;
        const isFirst = root.namedChildren.slice(0, index).every((previous) => previous.type.includes('comment'));
        const isDocstring = isFirst && node.type === 'expression_statement' && node.namedChildren[0]?.type === 'string';
        return !(language === 'python' && isDocstring);
    });
    return statements.length > 0 && !statements.some((child) => isSubstantial(child, language, threshold));
}

/**
 * The message for a function at or under the statement limit.
 * @param name what the message calls the function, such as its name or "This function"
 * @param count the executable statements it holds
 * @param threshold the statement limit
 * @returns the message
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Five engines report trivial functions; one owner keeps their wording the same.
export function trivialFunctionText(name: string, count: number, threshold: number): string {
    const statements = count === 1 ? '1 statement' : `${String(count)} statements`;
    return `${name} has ${statements}. Functions with ${String(threshold)} or fewer are reported. Inline it into its callers, or explain the API it serves in a narrow suppression.`;
}
