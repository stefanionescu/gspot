import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding, EngineInput } from '#cli/types/checks.ts';
import { grammarFor, parseSource } from '#cli/parsers/tree-sitter.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';

import {
    CONFIG_STATEMENTS,
    CONFIG_LOGIC_NODES,
    CONFIG_CALL_ALLOWED,
    LANGUAGE_BY_EXTENSION,
    CONFIG_IMPORT_PREFIXES,
} from '#cli/config/checks/repository.ts';

function configurationRolePaths(input: EngineInput): string[] {
    const role = input.policyFiles.policy.architecture.roles['config'];
    if (role === undefined) return [];
    const listed = Array.isArray(role) ? role : [role];
    return listed.map((path) => (path.includes('*') ? path : `${path.replace(/\/$/u, '')}/**`));
}

function isValueImportOutside(node: Node): boolean {
    if (node.type !== 'import_statement' || node.text.startsWith('import type')) return false;
    const source = node.childForFieldName('source')?.text.slice(1, -1) ?? '';
    return CONFIG_IMPORT_PREFIXES.every((prefix) => !source.startsWith(prefix));
}

function isAllowedCall(node: Node): boolean {
    if (node.type === 'new_expression')
        return CONFIG_CALL_ALLOWED.has(node.childForFieldName('constructor')?.text ?? '');
    return node.childForFieldName('arguments')?.type === 'template_string';
}

function isLogic(node: Node): boolean {
    if (CONFIG_LOGIC_NODES.has(node.type)) return true;
    return (node.type === 'call_expression' || node.type === 'new_expression') && !isAllowedCall(node);
}

function logicIn(node: Node, out: Node[]): void {
    if (isLogic(node)) {
        out.push(node);
        return;
    }
    for (const child of node.namedChildren) logicIn(child, out);
}

function problemsOf(root: Node): { line: number; message: string }[] {
    const problems: { line: number; message: string }[] = [];
    for (const statement of root.namedChildren) {
        if (!CONFIG_STATEMENTS.has(statement.type))
            problems.push({
                line: statement.startPosition.row + 1,
                message: `a ${statement.type.replaceAll('_', ' ')} is not a literal`,
            });
        else if (isValueImportOutside(statement))
            problems.push({
                line: statement.startPosition.row + 1,
                message: 'a value import from outside the config roots',
            });
    }
    const logic: Node[] = [];
    logicIn(root, logic);
    for (const node of logic)
        problems.push({ line: node.startPosition.row + 1, message: `a ${node.type.replaceAll('_', ' ')} is logic` });
    return problems.toSorted((a, b) => a.line - b.line);
}

async function fileFindings(input: EngineInput, file: TrackedFile, language: string): Promise<Finding[]> {
    const grammar = grammarFor(file.path, language);
    if (grammar === undefined) return [];
    const tree = await parseSource(grammar, readSource(input.root, file.path, input.reads).toString('utf8'), input);
    if (tree === null) throw new Error('The source parser returned no tree.');
    try {
        return problemsOf(tree.rootNode).map((problem) =>
            findingAt(
                input,
                { file: file.path, line: problem.line },
                'logic-in-config',
                `${problem.message}; a configuration module holds literals only.`,
            ),
        );
    } finally {
        tree.delete();
    }
}

/**
 * One finding per statement, call, function or control-flow construct in a file under the config role.
 * @param input the engine input
 * @returns the findings
 */
export async function fileIntegrity(input: EngineInput): Promise<Finding[]> {
    const isConfig = pathMatcher(configurationRolePaths(input));
    const findings: Finding[] = [];
    for (const file of input.files) {
        const dot = file.path.lastIndexOf('.');
        const language = dot === -1 ? undefined : LANGUAGE_BY_EXTENSION[file.path.slice(dot)];
        if (language === undefined || file.kind !== 'source' || !isConfig(file.path)) continue;
        findings.push(...(await fileFindings(input, file, language)));
    }
    return findings;
}
