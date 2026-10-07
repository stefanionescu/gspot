import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/finding.ts';
import { modulePath } from '#cli/repository/modules.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { rolePaths } from '#cli/policy/settings/lookup.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { ParsedFile, ParsedSource } from '#cli/types/parsers/source.ts';
import { grammarFor, visitParsedSources } from '#cli/parsers/tree-sitter.ts';
import { CONFIG_STATEMENTS, CONFIG_LOGIC_NODES, CONFIG_CALL_ALLOWED } from '#cli/config/checks/general/structure.ts';

function isOutsideImport(node: Node, input: CheckInput, path: string, isConfig: (path: string) => boolean): boolean {
    if (node.type !== 'import_statement' || node.text.startsWith('import type')) return false;
    const source = node.childForFieldName('source')?.text.slice(1, -1) ?? '';
    const target = modulePath(input, path, source);
    // Resolved JSON imports supply static data, even when shipped assets sit outside the configuration role.
    return target === undefined || (!target.endsWith('.json') && !isConfig(target));
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

function configurationFindings(
    input: CheckInput,
    source: ParsedSource,
    isConfig: (path: string) => boolean,
): Finding[] {
    const findings = [];
    for (const statement of source.rootNode.namedChildren) {
        if (!CONFIG_STATEMENTS.has(statement.type))
            findings.push(
                findingAt(
                    input,
                    { file: source.path, line: statement.startPosition.row + 1 },
                    'config-logic',
                    `Move this ${statement.type.replaceAll('_', ' ')} out of the configuration module. Keep literals here.`,
                ),
            );
        else if (isOutsideImport(statement, input, source.path, isConfig))
            findings.push(
                findingAt(
                    input,
                    { file: source.path, line: statement.startPosition.row + 1 },
                    'config-logic',
                    'Import values only from configuration roots or JSON data files. Move this runtime import out of the configuration module.',
                ),
            );
    }
    const logic: Node[] = [];
    logicIn(source.rootNode, logic);
    for (const node of logic)
        findings.push(
            findingAt(
                input,
                { file: source.path, line: node.startPosition.row + 1 },
                'config-logic',
                `Move this ${node.type.replaceAll('_', ' ')} out of the configuration module. Keep literals here.`,
            ),
        );
    return findings.toSorted((a, b) => a.line - b.line);
}

/**
 * One finding per statement, call, function or control-flow construct in a file under the config role.
 * @param input the check input
 * @returns the findings
 */
export async function configurationLogic(input: CheckInput): Promise<Finding[]> {
    const paths = rolePaths(input.policyFiles.policy.architecture.roles, 'config').map((path) =>
        path.includes('*') ? path : `${path.replace(/\/$/u, '')}/**`,
    );
    const isConfig = pathMatcher(paths);
    const files: ParsedFile[] = [];
    for (const file of input.files) {
        const language = file.tags.find((tag) => tag === 'typescript' || tag === 'javascript');
        if (language === undefined || file.kind !== 'source' || !isConfig(file.path)) continue;
        const grammar = grammarFor(file.path, language);
        if (grammar !== undefined) files.push({ path: file.path, grammar });
    }
    const findings: Finding[] = [];
    await visitParsedSources({ ...input, files }, (source) =>
        findings.push(...configurationFindings(input, source, isConfig)),
    );
    return findings;
}
