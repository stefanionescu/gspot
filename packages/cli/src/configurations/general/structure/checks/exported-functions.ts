import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { getLimit } from '#cli/settings/tables.ts';
import type { Session } from '#cli/types/tools.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { GrammarName } from '#cli/types/parsers.ts';
import { listCheckFiles } from '#cli/engine/plan/files.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { CheckFinding } from '#cli/types/engine/run.ts';
import { selectGrammar } from '#cli/configurations/syntax.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { joinScopeSelector } from '#cli/settings/values/paths.ts';
import { visitParsedSources } from '#cli/parsers/code/grammars.ts';
import { listApplicableTables } from '#cli/settings/values/written.ts';
import type { ScriptUse, ExportedFunction } from '#cli/types/configurations/structure.ts';

import {
    TEMPLATE_NAME,
    SCRIPT_GRAMMARS,
    SCRIPT_NAME_NODES,
    SCRIPT_NAMED_NODES,
    TEMPLATE_EXTENSIONS,
    SCRIPT_FUNCTION_VALUES,
    TEMPLATE_IMPORT_CLAUSE,
    TRIVIAL_FUNCTION_RULES,
    SCRIPT_TYPE_DECLARATIONS,
    SCRIPT_MODULE_NAME_PARENTS,
    SCRIPT_COUNTED_DECLARATIONS,
    SCRIPT_UNCOUNTED_STATEMENTS,
    SCRIPT_FUNCTION_DECLARATIONS,
} from '#cli/config/configurations/structure.ts';

/**
Count the statements of a JavaScript or TypeScript function as `gspot/no-trivial-functions` counts them: each nested
statement and declaration, and each arrow function whose body is an expression.
*/
function countScriptStatements(node: Node): number {
    if (SCRIPT_TYPE_DECLARATIONS.has(node.type)) return 0;
    const isExpressionBody =
        node.type === 'arrow_function' && node.childForFieldName('body')?.type !== 'statement_block';
    const isStatement = node.type.endsWith('_statement') && !SCRIPT_UNCOUNTED_STATEMENTS.has(node.type);
    const isLoopDeclaration = node.type === 'for_in_statement' && node.childForFieldName('kind') !== null;
    const own =
        Number(isExpressionBody) +
        Number(isStatement || SCRIPT_COUNTED_DECLARATIONS.has(node.type)) +
        Number(isLoopDeclaration);
    return node.namedChildren.reduce((total, child) => total + countScriptStatements(child), own);
}

/**
Find the function that a top-level statement exports: a function declaration, or the declarator of a constant set to
a function. Both hold the name of the function in their `name` field.
*/
function findExportedFunction(statement: Node): Node | undefined {
    const declaration = statement.type === 'export_statement' ? statement.childForFieldName('declaration') : null;
    if (declaration === null) return undefined;
    if (SCRIPT_FUNCTION_DECLARATIONS.has(declaration.type)) return declaration;
    const isConstant = declaration.type === 'lexical_declaration';
    return declaration.namedChildren.find(
        (child) => isConstant && SCRIPT_FUNCTION_VALUES.has(child.childForFieldName('value')?.type ?? ''),
    );
}

function listScriptFiles(
    files: readonly TrackedFile[],
    planned: PlannedCheck,
): Array<{ path: string; grammar: GrammarName }> {
    return files.flatMap((file) => {
        const grammars = planned.scope.settings.configurations.map((language) => selectGrammar(file.path, language));
        const grammar = grammars.find((found) => found !== undefined && SCRIPT_GRAMMARS.has(found));
        return grammar === undefined ? [] : [{ path: file.path, grammar }];
    });
}

function findCallerName(node: Node, path: string): string {
    let caller: string | undefined;
    for (let parent = node.parent; parent !== null; parent = parent.parent)
        if (SCRIPT_NAMED_NODES.has(parent.type)) caller = parent.childForFieldName('name')?.text ?? caller;
    return caller ?? path;
}

function isDefinitionName(node: Node, parent: Node): boolean {
    if (SCRIPT_MODULE_NAME_PARENTS.has(parent.type)) return true;
    return SCRIPT_NAMED_NODES.has(parent.type) && parent.childForFieldName('name')?.id === node.id;
}

function listScriptUses(rootNode: Node, path: string, names: ReadonlySet<string>): ScriptUse[] {
    return rootNode.descendantsOfType(SCRIPT_NAME_NODES).flatMap((node) => {
        const { parent } = node;
        if (!names.has(node.text) || parent === null || isDefinitionName(node, parent)) return [];
        const isCall = parent.type === 'call_expression' && parent.childForFieldName('function')?.id === node.id;
        return [{ name: node.text, ...(isCall && { caller: findCallerName(node, path) }) }];
    });
}

/**
List the uses of the names in the script files and the component files of the scope, apart from the definitions, the
imports, and the exports. Only a file whose text holds one of the names gets read.
*/
async function listNameUses(session: Session, planned: PlannedCheck, names: ReadonlySet<string>): Promise<ScriptUse[]> {
    const { scope } = planned;
    const hasName = (file: TrackedFile): boolean => {
        const text = readText(session.cache, file.path);
        return names.values().some((name) => text.includes(name));
    };
    const sources = listCheckFiles({ scope, files: session.repository.files }, planned.check.id);
    const files = listScriptFiles(
        sources.filter((file) => hasName(file)),
        planned,
    );
    const uses: ScriptUse[] = [];
    await visitParsedSources({ cache: session.cache, resources: session.resources, files }, (source) => {
        uses.push(...listScriptUses(source.rootNode, source.path, names));
    });
    for (const file of session.repository.files) {
        if (!isInScope(file.path, scope.path) || !TEMPLATE_EXTENSIONS.has(posix.extname(file.path))) continue;
        const code = readText(session.cache, file.path).replaceAll(TEMPLATE_IMPORT_CLAUSE, '');
        for (const [, name = '', call] of code.matchAll(TEMPLATE_NAME))
            if (names.has(name)) uses.push({ name, ...(call !== undefined && { caller: file.path }) });
    }
    return uses;
}

async function listExportedFunctions(session: Session, planned: PlannedCheck): Promise<ExportedFunction[]> {
    const { scope } = planned;
    const entryFiles = listApplicableTables(session.settings, scope.path).flatMap(({ table, scopePath = '' }) =>
        (table.javascript?.entry_files ?? []).map((pattern) => joinScopeSelector(pattern, scopePath)),
    );
    const isEntryFile = buildPathMatcher(entryFiles);
    const files = listScriptFiles(
        planned.files.filter((file) => !isEntryFile(file.path)),
        planned,
    );
    const functions: ExportedFunction[] = [];
    await visitParsedSources({ cache: session.cache, resources: session.resources, files }, (source) => {
        const language = source.grammar === 'tsx' ? 'typescript' : source.grammar;
        const limit = getLimit(scope.settings, 'trivial_function_statements', language);
        for (const statement of source.rootNode.namedChildren) {
            const exported = findExportedFunction(statement);
            const name = exported?.childForFieldName('name')?.text;
            if (exported === undefined || name === undefined || countScriptStatements(exported) > limit) continue;
            const { row, column } = statement.startPosition;
            functions.push({ name, file: source.path, line: row + 1, column: column + 1 });
        }
    });
    return functions;
}

/**
Report each exported JavaScript or TypeScript function at the statement limit that one place in the scope names, when
that place calls it. `gspot/no-trivial-functions` reports the functions that a module keeps to itself. A file of
`javascript.entry_files` is left alone, because a tool calls its exports. A name that two files export is left alone
too, because its uses do not tell the two apart.
*/
export async function listSingleCallExports(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const functions = Map.groupBy(await listExportedFunctions(session, planned), ({ name }) => name);
    if (functions.size === 0) return [];
    const found = await listNameUses(session, planned, new Set(functions.keys()));
    const uses = Map.groupBy(found, ({ name }) => name);
    return [...functions].flatMap(([name, [exported, ...copies]]) => {
        const [use, ...others] = uses.get(name) ?? [];
        if (exported === undefined || use?.caller === undefined || copies.length + others.length > 0) return [];
        const { file, line, column } = exported;
        const message = `Inline ${name} into ${use.caller} and delete it.`;
        return [{ file, line, column, rule: TRIVIAL_FUNCTION_RULES.trivialFunction, message }];
    });
}
