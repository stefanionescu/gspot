import { parseAllDocuments } from 'yaml';
import { visit } from 'unist-util-visit';
import { parse as parseToml } from 'smol-toml';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { parserFor } from '#cli/parsers/tree-sitter.ts';
import { readSource } from '#cli/repository/tracked.ts';
import type { FencedBlock } from '#cli/types/checks/docs.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import type { GrammarName } from '#cli/types/parsers/parsers.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';

const STRUCTURED_PARSERS = new Set(['json', 'toml', 'yaml']);
const TREE_PARSERS = new Set(['typescript', 'javascript', 'python']);

function fencesOf(text: string): FencedBlock[] {
    const out: FencedBlock[] = [];
    visit(fromMarkdown(text), 'code', (node) => {
        if (node.lang !== undefined && node.lang !== null && node.lang !== '')
            out.push({ line: node.position?.start.line ?? 1, language: node.lang, body: node.value });
    });
    return out;
}

// A stream of YAML documents, as front matter examples are, parses document by document.
function yamlProblem(body: string): string | undefined {
    const failed = parseAllDocuments(body).find((document) => document.errors.length > 0);
    return failed?.errors[0] === undefined ? undefined : failed.errors[0].message.split('\n', 1)[0];
}

function structuredProblem(parser: string, body: string): string | undefined {
    try {
        if (parser === 'json') JSON.parse(body);
        else if (parser === 'toml') parseToml(body);
        else return yamlProblem(body);
        return undefined;
    } catch (error) {
        return (error as Error).message.split('\n', 1)[0];
    }
}

// What an example leaves out is not a syntax error: a line of dots stands for omitted code, <UPPER_CASE> for a value the reader supplies.
function withoutPlaceholders(body: string, parser: string): string {
    const noop = parser === 'bash' ? ':' : '';
    return body
        .split('\n')
        .map((line) => (ELLIPSIS_LINE.test(line) ? noop : line))
        .join('\n')
        .replaceAll(ELLIPSIS_ARGUMENTS, '()')
        .replaceAll(ANGLE_PLACEHOLDER, 'PLACEHOLDER');
}

async function treeProblem(grammar: GrammarName, body: string): Promise<string | undefined> {
    const parser = await parserFor(grammar);
    const tree = parser.parse(body);
    if (tree === null) return 'did not parse';
    try {
        return tree.rootNode.hasError ? `${grammar} syntax error` : undefined;
    } finally {
        tree.delete();
    }
}

async function bashProblem(input: EngineInput, body: string): Promise<string | undefined> {
    const result = await runCheckCommand(input, ['bash', '-n'], { cwd: input.root, stdin: body });
    if (result.code === 0) return undefined;
    const detail = result.stderr.trim().split('\n', 1)[0] ?? '';
    return detail === '' ? `bash exited ${String(result.code)}` : detail;
}

function problemFor(input: EngineInput, parser: string, body: string): Promise<string | undefined> {
    if (STRUCTURED_PARSERS.has(parser)) return Promise.resolve(structuredProblem(parser, body));
    if (parser === 'bash') return bashProblem(input, body);
    if (TREE_PARSERS.has(parser)) return treeProblem(parser as GrammarName, body);
    return Promise.resolve(undefined);
}

async function fileFindings(input: EngineInput, path: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const blocks = fencesOf(readSource(input.root, path, input.observations).toString('utf8'));
    for (const fence of blocks) {
        const parser = FENCE_PARSERS[fence.language];
        if (parser === undefined || fence.body.trim() === '') continue;
        const problem = await problemFor(input, parser, withoutPlaceholders(fence.body, parser));
        if (problem !== undefined)
            findings.push({
                check: input.spec.name,
                file: path,
                line: fence.line,
                rule: fence.language,
                message: `This ${fence.language} block does not parse: ${problem}.`,
                fixable: false,
            });
    }
    return findings;
}

const ELLIPSIS_LINE = /^[\s#/]*\.\.\.\s*$/u;

const ELLIPSIS_ARGUMENTS = '(...)';

const ANGLE_PLACEHOLDER = /<[A-Z][A-Z0-9_-]*>/gu;

const FENCE_PARSERS: Record<string, 'json' | 'toml' | 'yaml' | 'bash' | 'typescript' | 'javascript' | 'python'> = {
    json: 'json',
    jsonc: 'json',
    toml: 'toml',
    yaml: 'yaml',
    yml: 'yaml',
    bash: 'bash',
    sh: 'bash',
    shell: 'bash',
    ts: 'typescript',
    typescript: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    javascript: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    python: 'python',
    py: 'python',
};

/**
 * One finding per fenced block whose tagged language refuses to parse it.
 * @param input the engine input
 * @returns the findings
 */
export async function fences(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    const markdown = input.files.filter((entry) => entry.nature === 'source' && entry.path.endsWith('.md'));
    for (const file of markdown) findings.push(...(await fileFindings(input, file.path)));
    return findings;
}
