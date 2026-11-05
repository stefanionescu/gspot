import { basename } from 'node:path';

import type { Node } from 'web-tree-sitter';

import {
    BARE_NAME_NODES,
    BASH_COMMAND_NODES,
    BASH_SOURCE_COMMANDS,
    COUNTED_FUNCTION_NODES,
    DECORATED_PYTHON_NODE,
    FORWARDING_NODES,
    FUNCTION_LABEL,
    ONE_STATEMENT,
    PYTHON_EXPORT_LIST,
    PYTHON_PACKAGE_FILE,
    SWIFT_ACCESSOR_NODES,
    SWIFT_ACCESSOR_OWNERS,
    SWIFT_FUNCTION_LABELS,
    TRIVIAL_FILE_MESSAGE,
    TRIVIAL_FUNCTION_RULES,
    TYPE_ALIAS_NODES,
    TYPE_REFERENCE_NODES,
} from '#cli/config/configurations/structure.ts';
import { visitQueriedSources } from '#cli/configurations/general/structure/checks/parsed-sources.ts';
import { TRIVIAL_FUNCTION_EXPLANATIONS } from '#cli/configurations/general/structure/explanations.ts';
import { listCheckFiles } from '#cli/engine/files.ts';
import { isDocstring } from '#cli/parsers/code/python.ts';
import { getLimit } from '#cli/settings/scopes.ts';
import { findText } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { ParsedLanguage, ParsedSource } from '#cli/types/configurations/general.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';

type TrivialFunction = { finding: CheckFinding; key?: string };

// The syntax node of a name in a call, a reference, or a definition; a Bash function runs as a command word.
const NAME_NODES: Readonly<Record<ParsedLanguage, string>> = {
    python: 'identifier',
    swift: 'simple_identifier',
    bash: 'word',
};

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
    return node.type === 'variable_assignment'
        ? !BASH_COMMAND_NODES.has(node.parent?.type ?? '')
        : node.type.endsWith('_statement') && node.type !== 'compound_statement';
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
    if (
        node.type !== 'expression_statement' ||
        assignment?.type !== 'assignment' ||
        assignment.childForFieldName('type') !== null
    )
        return false;
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
    return TYPE_ALIAS_NODES.has(node.type)
        ? TYPE_REFERENCE_NODES.has((node.childForFieldName('value') ?? node.namedChildren.at(-1))?.type ?? '')
        : LANGUAGE_FORWARDING[language](node);
}

function countNodeStatements(node: Node, language: ParsedLanguage): number {
    if (!COUNTED_FUNCTION_NODES.has(node.type))
        return STATEMENT_COUNTS[language](node) + countExecutableStatements(node.namedChildren, language);
    return node.type === 'lambda'
        ? 1 + countExecutableStatements(node.namedChildren, language)
        : countExecutableStatements(extractFunctionBody(node, language), language);
}

function countExecutableStatements(nodes: Node[], language: ParsedLanguage): number {
    let count = 0;
    for (const node of nodes)
        if (!node.type.includes('comment') && !TYPE_ALIAS_NODES.has(node.type))
            count += countNodeStatements(node, language);
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
        if (SWIFT_ACCESSOR_OWNERS.has(declaration.type)) break;
        declaration = declaration.parent;
    }
    if (declaration === null) return label;
    const name =
        declaration.type === 'subscript_declaration' ? 'subscript' : declaration.childForFieldName('name')?.text;
    return name === undefined ? label : `${label} of ${name}`;
}

/**
Describe a function at the statement limit. A named function counts its callers, and an accessor, which code reaches
without its name, does not.

@param node the declaration, whose name or accessor label the message shows.
@param count the statements of its body, without comments and docstrings.
@param limit the most statements that the check reports.
*/
function formatTrivialFunction(node: Node, count: number, limit: number): string {
    const named = node.childForFieldName('name')?.text;
    const label = named ?? SWIFT_FUNCTION_LABELS[node.type] ?? FUNCTION_LABEL;
    const name = SWIFT_ACCESSOR_NODES.has(node.type) ? formatAccessorName(node, label) : label;
    const statements = count === 1 ? ONE_STATEMENT : `${String(count)} statements`;
    return named === undefined
        ? `${name} has ${statements}. Functions with ${String(limit)} or fewer are reported. Inline it into its callers, or record the API it serves with gspot ignore.`
        : `${name} has ${statements}, and one place calls it at most. Functions with ${String(limit)} or fewer statements and one caller are reported. Inline it into its caller, or record the API it serves with gspot ignore.`;
}

function listTrivialFunctions(planned: PlannedCheck, source: ParsedSource): TrivialFunction[] {
    const limit = getLimit(planned.scope.settings, 'min_function_statements', source.language);
    const functions = (source.captures.get(FUNCTION_LABEL) ?? []).filter(
        (node) => node.parent?.type !== DECORATED_PYTHON_NODE,
    );
    return functions.flatMap((node) => {
        const count = countExecutableStatements(extractFunctionBody(node, source.language), source.language);
        if (count > limit) return [];
        const named = node.childForFieldName('name')?.text;
        const finding = {
            file: source.path,
            line: node.startPosition.row + 1,
            column: node.startPosition.column + 1,
            rule: TRIVIAL_FUNCTION_RULES.trivialFunction,
            message: formatTrivialFunction(node, count, limit),
        };
        return [{ finding, ...(named !== undefined && { key: `${source.language} ${named}` }) }];
    });
}

function isImportedName(node: Node): boolean {
    for (let parent = node.parent; parent !== null; parent = parent.parent)
        if (parent.type.startsWith('import')) return true;
    return false;
}

/**
Count the places that name each function in the files of the check in the scope, apart from the definitions and the
imports. Only a file whose text holds one of the names gets parsed.

@param session the repository and its tools.
@param planned the scope and the check whose files to read.
@param keys the language and name of each function, joined by a space.
*/
async function countNameUses(
    session: Session,
    planned: PlannedCheck,
    keys: ReadonlySet<string>,
): Promise<Map<string, number>> {
    const names = [...keys].map((key) => key.slice(key.indexOf(' ') + 1));
    const files = listCheckFiles({ scope: planned.scope, files: session.repository.files }, planned.check.id).filter(
        (file) => {
            const text = findText(session.cache, file.path) ?? '';
            return names.some((name) => text.includes(name));
        },
    );
    const uses = new Map<string, number>();
    await visitQueriedSources(session, { ...planned, files }, (source) => {
        const definitions = new Set(
            (source.captures.get(FUNCTION_LABEL) ?? []).map((node) => node.childForFieldName('name')?.id),
        );
        const nameNodes = source.rootNode.descendantsOfType(NAME_NODES[source.language]);
        for (const node of nameNodes) {
            const key = `${source.language} ${node.text}`;
            if (keys.has(key) && !definitions.has(node.id) && !isImportedName(node))
                uses.set(key, (uses.get(key) ?? 0) + 1);
        }
    });
    return uses;
}

/**
Report named functions at the statement limit that one place calls at most, accessors at the limit, and files that
only forward code. A function counts the places in the scope that name it, so a helper that two places share passes.

@param session the repository and its tools.
@param planned the scope files and statement limits.
*/
async function checkTrivialFunctions(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const isTest = buildPathMatcher(planned.scope.settings.test_files);
    const hasPackageExports = session.settings.structure.reexports === 'index-only';
    const trivialFunctions: TrivialFunction[] = [];
    const trivialFiles: Array<{ path: string; line: number }> = [];
    await visitQueriedSources(session, planned, (source) => {
        if (source.language === 'python' && isTest(source.path)) return;
        trivialFunctions.push(...listTrivialFunctions(planned, source));
        if (!isTrivialFile(source.rootNode, source.language)) return;
        const statement = source.rootNode.namedChildren.find((node) => !node.type.includes('comment'));
        trivialFiles.push({
            path: source.path,
            line: source.language === 'bash' ? 1 : (statement?.startPosition.row ?? 0) + 1,
        });
    });
    const files = trivialFiles
        .filter(({ path }) => !hasPackageExports || basename(path) !== PYTHON_PACKAGE_FILE)
        .map(({ path, line }) => ({
            file: path,
            line,
            rule: TRIVIAL_FUNCTION_RULES.trivialFile,
            message: TRIVIAL_FILE_MESSAGE,
        }));
    const keys = new Set(trivialFunctions.flatMap(({ key }) => (key === undefined ? [] : [key])));
    const uses = keys.size === 0 ? new Map<string, number>() : await countNameUses(session, planned, keys);
    const functions = trivialFunctions
        .filter(({ key }) => key === undefined || (uses.get(key) ?? 0) <= 1)
        .map(({ finding }) => finding);
    return [...functions, ...files];
}

export const STRUCTURE_TRIVIAL_FUNCTIONS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'structure/trivial-functions': { check: checkTrivialFunctions, explanations: TRIVIAL_FUNCTION_EXPLANATIONS },
};
