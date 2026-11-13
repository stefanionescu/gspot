import type { Node } from 'web-tree-sitter';

import {
    DEFAULT_EXPORT_NAME,
    FUNCTION_ORDER_RULE,
    SCRIPT_FUNCTION_DECLARATIONS,
    SCRIPT_FUNCTION_VALUES,
    TEST_CALL_NAMES,
} from '#cli/config/configurations/structure.ts';
import { selectGrammar, visitParsedSources } from '#cli/parsers/code/grammars.ts';
import { isPrivateSwiftDeclaration } from '#cli/parsers/code/swift.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { TopLevelFunction } from '#cli/types/configurations/general.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { GrammarName, SourceTree } from '#cli/types/parsers.ts';
import type { Session } from '#cli/types/tools.ts';

function describePythonFunction(statement: Node): TopLevelFunction | undefined {
    const declaration =
        statement.type === 'decorated_definition' ? statement.childForFieldName('definition') : statement;
    const name = declaration?.type === 'function_definition' ? declaration.childForFieldName('name')?.text : undefined;
    return name === undefined
        ? undefined
        : { name, isPrivate: name.startsWith('_') && !(name.startsWith('__') && name.endsWith('__')) };
}

function describeSwiftFunction(statement: Node): TopLevelFunction | undefined {
    const name = statement.type === 'function_declaration' ? statement.childForFieldName('name')?.text : undefined;
    if (name === undefined) return undefined;
    return { name, isPrivate: isPrivateSwiftDeclaration(statement) };
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
    return grammar === 'swift' ? describeSwiftFunction(statement) : describeScriptFunction(statement, listed);
}

function findCallee(call: Node): Node | null {
    let node: Node | null = call;
    while (node?.type === 'call_expression' || node?.type === 'member_expression')
        node = node.childForFieldName(node.type === 'call_expression' ? 'function' : 'object');
    return node;
}

function isTestCall(statement: Node): boolean {
    const call = statement.type === 'expression_statement' ? statement.namedChildren[0] : undefined;
    if (call?.type !== 'call_expression') return false;
    const callee = findCallee(call);
    return callee?.type === 'identifier' && TEST_CALL_NAMES.has(callee.text);
}

function listFunctionOrderFindings(source: SourceTree, { isTest }: { isTest: boolean }): CheckFinding[] {
    const { rootNode, path, grammar } = source;
    const listed = listExportedNames(rootNode);
    const hasTestCalls = isTest && grammar !== 'python' && grammar !== 'swift';
    const statements = rootNode.namedChildren.map((statement) => ({
        statement,
        described: describeTopLevelFunction(statement, grammar, listed),
    }));
    const start = statements.findIndex(({ statement, described }) =>
        described === undefined ? hasTestCalls && isTestCall(statement) : !described.isPrivate,
    );
    if (start === -1) return [];
    const firstPublic = statements[start]?.described?.name;
    return statements.slice(start + 1).flatMap(({ statement, described }) => {
        if (described?.isPrivate !== true) return [];
        const { name } = described;
        return [
            {
                file: path,
                line: statement.startPosition.row + 1,
                column: statement.startPosition.column + 1,
                rule: FUNCTION_ORDER_RULE,
                message:
                    firstPublic === undefined
                        ? `The helper ${name} sits below the first test. Move ${name} above the first test.`
                        : `The private function ${name} sits below the public function ${firstPublic}. Move ${name} above ${firstPublic}.`,
            },
        ];
    });
}

/**
Report each private top-level function below the first public one, so that a reader finds a helper before the code that
uses it. Python marks a private function with a leading `_`, and Swift with `private` or `fileprivate`. In JavaScript
and TypeScript, a function or a constant set to a function stays private unless the module exports it, and in a test
file the first top-level `test`, `it`, or `describe` call counts as the first public function.
*/
async function checkFunctionOrder(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const isTestFile = buildPathMatcher(planned.scope.settings.test_files);
    const files = planned.files.flatMap((file) => {
        const grammars = planned.scope.settings.configurations.map((language) => selectGrammar(file.path, language));
        const grammar = grammars.find((found) => found !== undefined);
        return grammar === undefined ? [] : [{ path: file.path, grammar }];
    });
    const findings: CheckFinding[] = [];
    await visitParsedSources({ cache: session.cache, resources: session.resources, files }, (source) => {
        findings.push(...listFunctionOrderFindings(source, { isTest: isTestFile(source.path) }));
    });
    return findings;
}

export const STRUCTURE_FUNCTION_ORDER_CHECKS: Readonly<Record<string, CheckCode>> = {
    'structure/function-order': { check: checkFunctionOrder },
};
