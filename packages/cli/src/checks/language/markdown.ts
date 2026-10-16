import { visit } from 'unist-util-visit';
import { parseAllDocuments } from 'yaml';
import { findingAt } from '#cli/checks/finding.ts';
import { computePosition } from '#cli/system/text.ts';
import { readSource } from '#cli/system/files/reads.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { TomlError, parse as parseToml } from 'smol-toml';
import { JSONC_OPTIONS } from '#cli/config/parsers/json.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import type { ParseCache, GrammarName } from '#cli/types/parsers/tree-sitter.ts';
import { parse, type ParseError, type ParseOptions, printParseErrorCode } from 'jsonc-parser';
import type { FenceParser, FencedBlock, FenceSyntaxError } from '#cli/types/checks/language.ts';

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
} from '#cli/config/checks/language/markdown.ts';

function jsonSyntaxError(body: string, options: ParseOptions): FenceSyntaxError | undefined {
    const errors: ParseError[] = [];
    parse(body, errors, options);
    const error = errors[0];
    if (error === undefined) return undefined;
    const diagnostic = printParseErrorCode(error.error)
        .replaceAll(CAMEL_CASE_BOUNDARY, '$<first> $<next>')
        .toLowerCase();
    return { line: computePosition(body, error.offset).line, message: `JSON syntax error: ${diagnostic}.` };
}

function tomlSyntaxError(body: string): FenceSyntaxError | undefined {
    try {
        parseToml(body);
        return undefined;
    } catch (error) {
        if (!(error instanceof TomlError)) throw error;
        return { line: error.line, message: error.message.split('\n', 1).join('') };
    }
}

function yamlSyntaxError(body: string): FenceSyntaxError | undefined {
    const error = parseAllDocuments(body).flatMap((document) => document.errors)[0];
    if (error === undefined) return undefined;
    return { line: computePosition(body, error.pos[0]).line, message: error.message.split('\n', 1).join('') };
}

async function treeSyntaxError(
    grammar: GrammarName,
    body: string,
    cache?: ParseCache,
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
 * Read language-tagged Markdown examples with source positions.
 * @param text the Markdown source.
 * @returns the parsed code fences.
 */
function codeFences(text: string): FencedBlock[] {
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
 * Parse language-tagged examples and locate errors in their Markdown source lines.
 * @param text the Markdown source.
 * @param cache the existing run-owned grammar cache, when checking repository files.
 * @returns one syntax finding per invalid example, with aliases sharing the same outcome.
 */
async function fenceSyntaxErrors(text: string, cache?: ParseCache): Promise<FenceSyntaxError[]> {
    const readers: Record<
        FenceParser,
        (body: string) => FenceSyntaxError | undefined | Promise<FenceSyntaxError | undefined>
    > = {
        json: (body) => jsonSyntaxError(body, JSON_FENCE_OPTIONS),
        jsonc: (body) => jsonSyntaxError(body, JSONC_OPTIONS),
        toml: tomlSyntaxError,
        yaml: yamlSyntaxError,
        bash: (body) => treeSyntaxError('bash', body, cache),
        typescript: (body) => treeSyntaxError('typescript', body, cache),
        tsx: (body) => treeSyntaxError('tsx', body, cache),
        javascript: (body) => treeSyntaxError('javascript', body, cache),
        python: (body) => treeSyntaxError('python', body, cache),
    };
    const findings: FenceSyntaxError[] = [];
    for (const fence of codeFences(text)) {
        const parser = Object.entries(FENCE_PARSERS).find(([language]) => language === fence.language)?.[1];
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
 * Report invalid tagged examples at their error lines;
 * @param input the selected Markdown files and tool execution state.
 * @returns one syntax finding per invalid code example.
 */
export async function markdownFences(input: CheckInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const file of input.files) {
        input.cancelSignal?.throwIfAborted();
        const text = readSource(input.root, file.path, input.reads).toString('utf8');
        const syntaxFindings = await fenceSyntaxErrors(text, input);
        input.cancelSignal?.throwIfAborted();
        findings.push(
            ...syntaxFindings.map((finding) =>
                findingAt(
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
 * Keep Markdown filenames literal in markdownlint-cli2 arguments.
 * @param input the selected check and repository files.
 * @returns the command arguments with the planned Markdown files.
 */
export function markdownlintArguments(input: CheckInput): string[] {
    return input.files.map((file) => `${MARKDOWNLINT_PATH_PREFIX}${file.path}`);
}
