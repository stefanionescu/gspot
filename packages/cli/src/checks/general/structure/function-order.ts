import type { Node } from 'web-tree-sitter';
import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import type { GrammarName } from '#cli/types/parsers/code.ts';
import type { TopLevelFunction } from '#cli/types/checks/general/structure.ts';
import { selectGrammar, visitParsedSources } from '#cli/parsers/code/grammars.ts';

import {
    DEFAULT_EXPORT_NAME,
    FUNCTION_ORDER_RULE,
    SCRIPT_FUNCTION_VALUES,
    PRIVATE_SWIFT_VISIBILITIES,
    SCRIPT_FUNCTION_DECLARATIONS,
} from '#cli/config/checks/general/structure.ts';

function describePythonFunction(statement: Node): TopLevelFunction | undefined {
    const declaration =
        statement.type === 'decorated_definition' ? statement.childForFieldName('definition') : statement;
    const name = declaration?.type === 'function_definition' ? declaration.childForFieldName('name')?.text : undefined;
    if (name === undefined) return undefined;
    return { name, isPrivate: name.startsWith('_') && !(name.startsWith('__') && name.endsWith('__')) };
}

function describeSwiftFunction(statement: Node): TopLevelFunction | undefined {
    const name = statement.type === 'function_declaration' ? statement.childForFieldName('name')?.text : undefined;
    if (name === undefined) return undefined;
    const modifiers = statement.namedChildren.find((child) => child.type === 'modifiers')?.namedChildren ?? [];
    const isPrivate = modifiers.some(
        (modifier) => modifier.type === 'visibility_modifier' && PRIVATE_SWIFT_VISIBILITIES.has(modifier.text),
    );
    return { name, isPrivate };
}

function findScriptFunctionName(node: Node): string | undefined {
    if (SCRIPT_FUNCTION_VALUES.has(node.type)) return DEFAULT_EXPORT_NAME;
    if (SCRIPT_FUNCTION_DECLARATIONS.has(node.type)) return node.childForFieldName('name')?.text;
    if (node.type !== 'lexical_declaration') return undefined;
    const declarator = node.namedChildren.find((child) =>
        SCRIPT_FUNCTION_VALUES.has(child.childForFieldName('value')?.type ?? ''),
    );
    return declarator?.childForFieldName('name')?.text;
}

function describeScriptFunction(statement: Node, listed: ReadonlySet<string>): TopLevelFunction | undefined {
    const isExport = statement.type === 'export_statement';
    const declaration = isExport
        ? (statement.childForFieldName('declaration') ?? statement.childForFieldName('value'))
        : statement;
    const name = declaration === null ? undefined : findScriptFunctionName(declaration);
    return name === undefined ? undefined : { name, isPrivate: !isExport && !listed.has(name) };
}

function listExportedNames(rootNode: Node): Set<string> {
    const lists = rootNode.namedChildren.filter(
        (statement) => statement.type === 'export_statement' && statement.childForFieldName('source') === null,
    );
    return new Set(
        lists.flatMap((statement) =>
            statement.descendantsOfType('export_specifier').flatMap((specifier) => {
                const name = specifier.childForFieldName('name')?.text;
                return name === undefined ? [] : [name];
            }),
        ),
    );
}

function describeTopLevelFunction(
    statement: Node,
    grammar: GrammarName,
    listed: ReadonlySet<string>,
): TopLevelFunction | undefined {
    if (grammar === 'python') return describePythonFunction(statement);
    if (grammar === 'swift') return describeSwiftFunction(statement);
    return describeScriptFunction(statement, listed);
}

function listFunctionOrderFindings(rootNode: Node, path: string, grammar: GrammarName): CheckFinding[] {
    const listed = listExportedNames(rootNode);
    const functions = rootNode.namedChildren.flatMap((statement) => {
        const described = describeTopLevelFunction(statement, grammar, listed);
        return described === undefined ? [] : [{ statement, ...described }];
    });
    const firstPublic = functions.find(({ isPrivate }) => !isPrivate);
    if (firstPublic === undefined) return [];
    return functions
        .slice(functions.indexOf(firstPublic) + 1)
        .filter(({ isPrivate }) => isPrivate)
        .map(({ statement, name }) => ({
            file: path,
            line: statement.startPosition.row + 1,
            column: statement.startPosition.column + 1,
            rule: FUNCTION_ORDER_RULE,
            message: `The private function ${name} sits below the public function ${firstPublic.name}. Move ${name} above ${firstPublic.name}.`,
        }));
}

/**
Report each private top-level function below a public one. Python marks a private function with a leading `_`, and
Swift with `private` or `fileprivate`. In JavaScript and TypeScript, a function or a constant set to a function stays
private unless the module exports it.

@param session the repository and its tools.
@param planned the scope sources and the configurations that select their grammars.
*/
export async function checkFunctionOrder(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const files = planned.files.flatMap((file) => {
        const grammars = planned.scope.settings.configurations.map((language) => selectGrammar(file.path, language));
        const grammar = grammars.find((found) => found !== undefined);
        return grammar === undefined ? [] : [{ path: file.path, grammar }];
    });
    const grammarByPath = new Map(files.map(({ path, grammar }) => [path, grammar]));
    const findings: CheckFinding[] = [];
    await visitParsedSources({ cache: session.cache, resources: session.resources, files }, (source) => {
        const grammar = grammarByPath.get(source.path);
        if (grammar !== undefined) findings.push(...listFunctionOrderFindings(source.rootNode, source.path, grammar));
    });
    return findings;
}
