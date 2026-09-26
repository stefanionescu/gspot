// Counting executable statements in Python, Swift, and Bash syntax trees, and telling a trivial file from a real one.
import type { Node } from 'web-tree-sitter';

type Language = 'python' | 'swift' | 'bash';
type Substance = (node: Node, language: Language, threshold: number) => boolean;

const FUNCTIONS = new Set([
    'function_definition',
    'function_declaration',
    'init_declaration',
    'deinit_declaration',
    'lambda',
    'lambda_literal',
    'computed_getter',
    'computed_setter',
    'computed_property',
    'willset_clause',
    'didset_clause',
]);
const TYPE_ALIASES = new Set(['type_alias_statement', 'typealias_declaration']);
const CONTAINERS = new Set([
    'decorated_definition',
    'class_definition',
    'class_declaration',
    'class_body',
    'block',
    'source_file',
    'module',
    'program',
    'computed_property',
]);
const CONTAINER_NOISE = new Set(['identifier', 'type_identifier', 'modifiers', 'decorator', 'inheritance_specifier']);
const NAMES = new Set(['identifier', 'simple_identifier', 'attribute', 'navigation_expression']);
const TYPE_REFERENCES = new Set(['type', 'user_type', 'identifier', 'type_identifier']);

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

// Whether a node carries no statement at all: a comment or a type alias.
function isSkipped(node: Node): boolean {
    return node.type.includes('comment') || TYPE_ALIASES.has(node.type);
}

// Whether a Python statement is a docstring: the first statement of a body when it is a bare string.
function isDocstring(node: Node, index: number): boolean {
    return index === 0 && node.type === 'expression_statement' && node.namedChildren[0]?.type === 'string';
}

// Whether a function holds more executable statements than the trivial threshold, ignoring a Python docstring.
function isSubstantialFunction(node: Node, language: Language, threshold: number): boolean {
    if (node.type === 'lambda') return false;
    const body = node.childForFieldName('body') ?? node;
    const children = body.namedChildren.filter((child, index) => !(language === 'python' && isDocstring(child, index)));
    return executableStatements(children, language) > threshold;
}

// Whether any member of a class, block, or module is substantial.
function hasSubstantialMember(node: Node, language: Language, threshold: number): boolean {
    const body = node.childForFieldName('body');
    return (body?.namedChildren ?? node.namedChildren)
        .filter((child) => !CONTAINER_NOISE.has(child.type))
        .some((child) => isSubstantial(child, language, threshold));
}

// Whether an assignment does more than forward a name: it declares a type, or its value is substantial.
function isSubstantialAssignment(node: Node, language: Language, threshold: number): boolean {
    if (node.childForFieldName('left')?.text === '__all__') return false;
    const value = node.childForFieldName('right');
    return node.childForFieldName('type') !== null || (value !== null && isSubstantial(value, language, threshold));
}

// Whether a type alias names more than another type.
function isSubstantialAlias(node: Node): boolean {
    const value = node.childForFieldName('value') ?? node.namedChildren.at(-1);
    return value !== undefined && !TYPE_REFERENCES.has(value.type);
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
    type_alias_statement: isSubstantialAlias,
    typealias_declaration: isSubstantialAlias,
};

// Whether a Bash command does more than source another file.
function isRealCommand(node: Node): boolean {
    const name = node.childForFieldName('name')?.text;
    return name !== 'source' && name !== '.';
}

// The node kinds one language reads differently from the others.
const LANGUAGE_SUBSTANCE: Record<Language, Record<string, Substance>> = {
    bash: { command: isRealCommand },
    python: {},
    swift: {},
};

// Whether a Swift computed property has no statements body, so its substance is that of its accessors.
function isAccessorProperty(node: Node): boolean {
    return node.type === 'computed_property' && !node.namedChildren.some((child) => child.type === 'statements');
}

// Whether a node can never be substantial: a comment, an import, a shebang, or a bare name.
function isInert(node: Node): boolean {
    if (node.type.includes('comment') || node.type.startsWith('import')) return true;
    return node.type === 'hash_bang_line' || NAMES.has(node.type);
}

// Whether a node does something a file could not do without: not an import, a name, a forwarding, or a trivial function.
function isSubstantial(node: Node, language: Language, threshold: number): boolean {
    if (isInert(node)) return false;
    if (isAccessorProperty(node)) return node.namedChildren.some((child) => isSubstantial(child, language, threshold));
    if (FUNCTIONS.has(node.type)) return isSubstantialFunction(node, language, threshold);
    if (CONTAINERS.has(node.type)) return hasSubstantialMember(node, language, threshold);
    const substance = LANGUAGE_SUBSTANCE[language][node.type] ?? SUBSTANCE[node.type];
    return substance === undefined ? true : substance(node, language, threshold);
}

// Whether a top-level Python statement is the module docstring: a bare string after only comments.
function isModuleDocstring(root: Node, node: Node, index: number): boolean {
    const isFirst = root.namedChildren.slice(0, index).every((previous) => previous.type.includes('comment'));
    return isFirst && node.type === 'expression_statement' && node.namedChildren[0]?.type === 'string';
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
        if (isSkipped(node)) continue;
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
    const statements = root.namedChildren.filter(
        (node, index) =>
            !node.type.includes('comment') && !(language === 'python' && isModuleDocstring(root, node, index)),
    );
    return statements.length > 0 && !statements.some((child) => isSubstantial(child, language, threshold));
}
