import type { Node } from 'web-tree-sitter';
import type { Finding } from '#cli/checks/result.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { grammarFor, parseSource } from '#cli/parsers/tree-sitter.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.mts': 'typescript',
    '.cts': 'typescript',
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
};

function configurationRolePaths(input: EngineInput): string[] {
    const role = input.policyFiles.policy.architecture.roles['config'];
    if (role === undefined) return [];
    const listed = Array.isArray(role) ? role : [role];
    return listed.map((path) => (path.includes('*') ? path : `${path.replace(/\/$/u, '')}/**`));
}

function languageOf(file: TrackedFile): string | undefined {
    const dot = file.path.lastIndexOf('.');
    return dot === -1 ? undefined : LANGUAGE_BY_EXTENSION[file.path.slice(dot)];
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
    const tree = await parseSource(
        grammar,
        readSource(input.root, file.path, input.observations).toString('utf8'),
        input,
    );
    if (tree === null) throw new Error('The source parser returned no tree.');
    try {
        return problemsOf(tree.rootNode).map((problem) => ({
            check: input.spec.name,
            file: file.path,
            line: problem.line,
            rule: 'logic-in-config',
            message: `${problem.message}; a configuration module holds literals only.`,
            fixable: false,
        }));
    } finally {
        tree.delete();
    }
}

/**
 * One finding per statement, call, function or control-flow construct in a file under the config role.
 * @param input the engine input
 * @returns the findings
 */
export async function configurationPurity(input: EngineInput): Promise<Finding[]> {
    const isConfig = pathMatcher(configurationRolePaths(input));
    const findings: Finding[] = [];
    for (const file of input.files) {
        const language = languageOf(file);
        if (language === undefined || file.nature !== 'source' || !isConfig(file.path)) continue;
        findings.push(...(await fileFindings(input, file, language)));
    }
    return findings;
}

const CONFIG_STATEMENTS = new Set([
    'import_statement',
    'export_statement',
    'lexical_declaration',
    'type_alias_declaration',
    'comment',
    'empty_statement',
]);

const CONFIG_LOGIC_NODES = new Set([
    'function_declaration',
    'generator_function_declaration',
    'function_expression',
    'arrow_function',
    'class_declaration',
    'if_statement',
    'for_statement',
    'for_in_statement',
    'while_statement',
    'do_statement',
    'switch_statement',
    'try_statement',
    'await_expression',
    'ternary_expression',
]);

const CONFIG_CALL_ALLOWED = new Set(['Set', 'Map', 'RegExp']);

const CONFIG_IMPORT_PREFIXES = ['#config/'];
