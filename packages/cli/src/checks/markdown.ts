import { visit } from 'unist-util-visit';
import { parseAllDocuments } from 'yaml';
import { buildFinding } from '#cli/runs/finding.ts';
import { computePosition } from '#cli/system/text.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { JSONC_OPTIONS } from '#cli/config/parsers/json.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';
import type { ParseCache, GrammarName } from '#cli/types/parsers/tree-sitter.ts';
import { parse, type ParseError, type ParseOptions, printParseErrorCode } from 'jsonc-parser';
import type { FenceParser, FencedBlock, FenceSyntaxError } from '#cli/types/checks/markdown.ts';

import {
    ELLIPSIS_LINE,
    FENCE_PARSERS,
    EMPTY_ARGUMENTS,
    ANGLE_PLACEHOLDER,
    OMITTED_BASH_LINE,
    PLACEHOLDER_VALUE,
    ELLIPSIS_ARGUMENTS,
    JSON_FENCE_OPTIONS,
    CAMEL_CASE_BOUNDARY,
    MARKDOWNLINT_PATH_PREFIX,
} from '#cli/config/checks/markdown.ts';

function findJsonSyntaxError(body: string, options: ParseOptions): FenceSyntaxError | undefined {
    const errors: ParseError[] = [];
    parse(body, errors, options);
    const error = errors[0];
    if (error === undefined) return undefined;
    const message = printParseErrorCode(error.error).replaceAll(CAMEL_CASE_BOUNDARY, '$<first> $<next>').toLowerCase();
    return { line: computePosition(body, error.offset).line, message: `JSON syntax error: ${message}.` };
}

function findTomlSyntaxError(body: string): FenceSyntaxError | undefined {
    try {
        parseToml(body);
        return undefined;
    } catch (error) {
        if (!(error instanceof Error) || !('line' in error) || typeof error.line !== 'number') throw error;
        return { line: error.line, message: error.message.split('\n', 1).join('') };
    }
}

function findYamlSyntaxError(body: string): FenceSyntaxError | undefined {
    const error = parseAllDocuments(body).flatMap((document) => document.errors)[0];
    if (error === undefined) return undefined;
    return { line: computePosition(body, error.pos[0]).line, message: error.message.split('\n', 1).join('') };
}

async function findTreeSyntaxError(
    grammar: GrammarName,
    body: string,
    cache: ParseCache,
): Promise<FenceSyntaxError | undefined> {
    const tree = await parseSource(grammar, body, cache);
    try {
        if (!tree.rootNode.hasError) return undefined;
        const error = tree.rootNode.descendantsOfType('ERROR')[0] ?? tree.rootNode;
        return { line: error.startPosition.row + 1, message: 'Syntax error.' };
    } finally {
        tree.delete();
    }
}

/**
 * Lists the language-tagged code fences of a Markdown file, with line numbers.
 * @param text the Markdown source.
 * @returns the parsed code fences.
 */
function parseCodeFences(text: string): FencedBlock[] {
    const blocks: FencedBlock[] = [];
    visit(fromMarkdown(text), 'code', (node) => {
        if (typeof node.lang !== 'string' || node.lang === '') return;
        blocks.push({
            line: node.position?.start.line ?? 1,
            language: node.lang,
            body: node.value,
        });
    });
    return blocks;
}

/**
 * Parses language-tagged code fences and reports syntax errors at their Markdown lines.
 * @param text the Markdown source.
 * @param cache the parsed grammars of the run.
 * @returns one syntax error per invalid code fence.
 */
async function validateCodeFences(text: string, cache: ParseCache): Promise<FenceSyntaxError[]> {
    const readers: Record<
        FenceParser,
        (body: string) => FenceSyntaxError | undefined | Promise<FenceSyntaxError | undefined>
    > = {
        json: (body) => findJsonSyntaxError(body, JSON_FENCE_OPTIONS),
        jsonc: (body) => findJsonSyntaxError(body, JSONC_OPTIONS),
        toml: findTomlSyntaxError,
        yaml: findYamlSyntaxError,
        bash: (body) => findTreeSyntaxError('bash', body, cache),
        typescript: (body) => findTreeSyntaxError('typescript', body, cache),
        tsx: (body) => findTreeSyntaxError('tsx', body, cache),
        javascript: (body) => findTreeSyntaxError('javascript', body, cache),
        python: (body) => findTreeSyntaxError('python', body, cache),
    };
    const findings: FenceSyntaxError[] = [];
    for (const fence of parseCodeFences(text)) {
        const parser = FENCE_PARSERS[fence.language];
        if (typeof parser !== 'string' || fence.body.trim() === '') continue;
        // Omitted code and placeholder values keep their lines without becoming syntax errors.
        const omitted = parser === 'bash' ? OMITTED_BASH_LINE : '';
        const body = fence.body
            .split('\n')
            .map((line) => (ELLIPSIS_LINE.test(line) ? omitted : line))
            .join('\n')
            .replaceAll(ELLIPSIS_ARGUMENTS, EMPTY_ARGUMENTS)
            .replaceAll(ANGLE_PLACEHOLDER, PLACEHOLDER_VALUE);
        const finding = await readers[parser](body);
        if (finding !== undefined) findings.push({ ...finding, line: fence.line + finding.line });
    }
    return findings;
}

/**
 * Reports invalid code fences at their error lines.
 * @param input the scope Markdown files.
 * @returns one finding per invalid code fence.
 */
export async function checkMarkdownFences(input: CheckInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const file of input.files) {
        const text = readCachedBytes(input.reads, file.path).toString('utf8');
        const syntaxFindings = await validateCodeFences(text, input);
        findings.push(
            ...syntaxFindings.map((finding) =>
                buildFinding(
                    input,
                    { file: file.path, line: finding.line },
                    'syntax',
                    `Fix this code example: ${finding.message}`,
                ),
            ),
        );
    }
    return findings;
}

/**
 * Builds markdownlint-cli2 arguments that keep Markdown file names literal.
 * @param input the scope Markdown files.
 * @returns the file arguments.
 */
export function buildMarkdownlintArguments(input: CheckInput): string[] {
    return input.files.map((file) => `${MARKDOWNLINT_PATH_PREFIX}${file.path}`);
}
