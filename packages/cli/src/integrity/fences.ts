import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parseAllDocuments } from 'yaml';
// Every fenced code block with a language tag parses in that language.
import { visit } from 'unist-util-visit';
import { parse as parseToml } from 'smol-toml';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { parserFor } from '#cli/naming/parsers.ts';
import type { GrammarName } from '#types/naming.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import type { FencedBlock } from '#types/integrity.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { ANGLE_PLACEHOLDER, ELLIPSIS_ARGUMENTS, ELLIPSIS_LINE, FENCE_PARSERS } from '#config/docs.ts';

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

function firstLine(text: string): string | undefined {
    return text.split('\n', 1)[0];
}

// A stream of YAML documents, as front matter examples are, parses document by document.
function yamlProblem(body: string): string | undefined {
    const failed = parseAllDocuments(body).find((document) => document.errors.length > 0);
    return failed?.errors[0] === undefined ? undefined : firstLine(failed.errors[0].message);
}

function structuredProblem(parser: string, body: string): string | undefined {
    try {
        if (parser === 'json') JSON.parse(body);
        else if (parser === 'toml') parseToml(body);
        else return yamlProblem(body);
        return undefined;
    } catch (error) {
        return firstLine((error as Error).message);
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

function bashProblem(root: string, body: string): string | undefined {
    const result = runBlocking(['bash', '-n'], { cwd: root, stdin: body });
    return result.code === 0 ? undefined : result.stderr.trim().split('\n', 1)[0];
}

function problemFor(root: string, parser: string, body: string): Promise<string | undefined> {
    if (STRUCTURED_PARSERS.has(parser)) return Promise.resolve(structuredProblem(parser, body));
    if (parser === 'bash') return Promise.resolve(bashProblem(root, body));
    if (TREE_PARSERS.has(parser)) return treeProblem(parser as GrammarName, body);
    return Promise.resolve(undefined);
}

async function fileFindings(input: EngineInput, path: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const blocks = fencesOf(readFileSync(join(input.root, path), 'utf8'));
    for (const fence of blocks) {
        const parser = FENCE_PARSERS[fence.language];
        if (parser === undefined || fence.body.trim() === '') continue;
        const problem = await problemFor(input.root, parser, withoutPlaceholders(fence.body, parser));
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
