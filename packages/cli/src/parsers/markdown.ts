// Markdown prose, rule sections and tagged code examples share one syntax-parsing owner.
import { parseAllDocuments } from 'yaml';
import { visit } from 'unist-util-visit';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { TomlError, parse as parseToml } from 'smol-toml';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import type { ProseLine, ParseReads, GrammarName } from '#cli/types/parsers/source.ts';
import { parse, type ParseError, type ParseOptions, printParseErrorCode } from 'jsonc-parser';

import type {
    FenceParser,
    FencedBlock,
    RuleSection,
    FenceSyntaxReader,
    FenceSyntaxFinding,
} from '#cli/types/parsers/markdown.ts';
import {
    PATH_CHARS,
    ELLIPSIS_LINE,
    FENCE_PARSERS,
    BASH_ERROR_LINE,
    FREE_TEXT_FENCES,
    PATH_TOKEN_SKIPS,
    TOKEN_SEPARATORS,
    ANGLE_PLACEHOLDER,
    ELLIPSIS_ARGUMENTS,
    TRAILING_PUNCTUATION,
} from '#cli/config/parsers/markdown.ts';

function withoutPunctuation(token: string): string {
    let end = token.length;
    while (end > 0 && TRAILING_PUNCTUATION.includes(token.charAt(end - 1))) end -= 1;
    return token.slice(0, end);
}

function getCodeFences(text: string): FencedBlock[] {
    const blocks: FencedBlock[] = [];
    visit(fromMarkdown(text), 'code', (node) => {
        if (typeof node.lang !== 'string' || node.lang === '') return;
        blocks.push({ line: node.position?.start.line ?? 1, language: node.lang, body: node.value });
    });
    return blocks;
}

function findJsonSyntaxFinding(body: string, options: ParseOptions): FenceSyntaxFinding | undefined {
    const errors: ParseError[] = [];
    parse(body, errors, options);
    const error = errors[0];
    if (error === undefined) return undefined;
    const diagnostic = printParseErrorCode(error.error)
        .replaceAll(/(?<first>[a-z])(?<next>[A-Z])/gu, '$<first> $<next>')
        .toLowerCase();
    return { line: body.slice(0, error.offset).split('\n').length, message: `JSON syntax error: ${diagnostic}.` };
}

function findTomlSyntaxFinding(body: string): FenceSyntaxFinding | undefined {
    try {
        parseToml(body);
        return undefined;
    } catch (error) {
        if (!(error instanceof TomlError)) throw error;
        return { line: error.line, message: error.message.split('\n', 1).join('') };
    }
}

function findYamlSyntaxFinding(body: string): FenceSyntaxFinding | undefined {
    const error = parseAllDocuments(body).flatMap((document) => document.errors)[0];
    if (error === undefined) return undefined;
    return { line: body.slice(0, error.pos[0]).split('\n').length, message: error.message.split('\n', 1).join('') };
}

async function findTreeSyntaxFinding(
    grammar: GrammarName,
    body: string,
    context?: ParseReads,
): Promise<FenceSyntaxFinding | undefined> {
    const tree = await parseSource(grammar, body, context);
    try {
        if (!tree.rootNode.hasError) return undefined;
        const error = tree.rootNode.descendantsOfType('ERROR')[0] ?? tree.rootNode;
        return { line: error.startPosition.row + 1, message: 'Syntax error.' };
    } finally {
        tree.delete();
    }
}

/**
 * The lines of Markdown outside free-text and titled example fences, with their numbers.
 * @param text the Markdown text.
 * @returns the lines a path check reads.
 */
export function proseLines(text: string): ProseLine[] {
    const ignored = new Set<number>();
    visit(fromMarkdown(text), 'code', (node) => {
        const titled = node.meta?.split(/\s+/u).some((attribute) => attribute.startsWith('title=')) === true;
        if ((!FREE_TEXT_FENCES.has(node.lang ?? '') && !titled) || node.position === undefined) return;
        for (let line = node.position.start.line; line <= node.position.end.line; line += 1) ignored.add(line);
    });
    return text.split('\n').flatMap((line, index) => (ignored.has(index + 1) ? [] : [{ number: index + 1, line }]));
}

/**
 * The tokens of one line that look like paths.
 * @param line the line.
 * @returns the path tokens.
 */
export function pathTokens(line: string): string[] {
    return line
        .split(TOKEN_SEPARATORS)
        .map((token) => withoutPunctuation(token))
        .map((token) => {
            const marker = token.startsWith('**') ? '**' : '*';
            if (token.startsWith(marker) && token.endsWith(marker)) return token.slice(marker.length, -marker.length);
            return token;
        })
        .filter(
            (token) =>
                token.includes('/') && PATH_CHARS.test(token) && PATH_TOKEN_SKIPS.every((skip) => !skip.test(token)),
        );
}

/**
 * Locate heading sections and their level markers without treating fenced headings as structure.
 * @param text the authored Markdown rule.
 * @returns source ranges, depths, and level markers for each heading.
 */
export function ruleSections(text: string): RuleSection[] {
    const nodes = fromMarkdown(text).children;
    const headings = nodes.flatMap((node, index) => {
        if (node.type !== 'heading') return [];
        const start = node.position?.start.offset;
        if (start === undefined) throw new Error('A parsed rule heading has no source position.');
        const marker = nodes[index + 1];
        return [
            { start, depth: node.depth, all: marker?.type === 'html' && marker.value.trim() === '<!-- level: all -->' },
        ];
    });
    return headings.map((heading, index) => ({
        ...heading,
        end: headings.slice(index + 1).find((next) => next.depth <= heading.depth)?.start ?? text.length,
    }));
}

/**
 * Read a native Bash syntax result without executing a process in the parser layer.
 * @param result the shell's exit status and diagnostic stream.
 * @returns the shell's syntax problem and body line, or undefined after success.
 */
export function parseBashSyntaxResult(result: Pick<SpawnResult, 'code' | 'stderr'>): FenceSyntaxFinding | undefined {
    if (result.code === 0) return undefined;
    const detail = result.stderr.trim().split('\n', 1).join('');
    const line = Number(BASH_ERROR_LINE.exec(detail)?.groups?.['line'] ?? '1');
    return { line, message: detail === '' ? `Bash exited with code ${String(result.code)}.` : detail };
}

/**
 * Parse language-tagged examples and locate errors in their Markdown source lines.
 * @param text the authored Markdown source.
 * @param checkBash the required native shell boundary, owned by the check.
 * @param context the existing run-owned grammar cache, when checking repository files.
 * @returns one syntax problem per invalid example, with aliases sharing the same outcome.
 */
export async function findFenceSyntaxFindings(
    text: string,
    checkBash: FenceSyntaxReader,
    context?: ParseReads,
): Promise<FenceSyntaxFinding[]> {
    const readers: Record<FenceParser, FenceSyntaxReader> = {
        json: (body) => findJsonSyntaxFinding(body, { disallowComments: true, allowTrailingComma: false }),
        jsonc: (body) => findJsonSyntaxFinding(body, { allowTrailingComma: true }),
        toml: findTomlSyntaxFinding,
        yaml: findYamlSyntaxFinding,
        bash: checkBash,
        typescript: (body) => findTreeSyntaxFinding('typescript', body, context),
        tsx: (body) => findTreeSyntaxFinding('tsx', body, context),
        javascript: (body) => findTreeSyntaxFinding('javascript', body, context),
        python: (body) => findTreeSyntaxFinding('python', body, context),
    };
    const findings: FenceSyntaxFinding[] = [];
    for (const fence of getCodeFences(text)) {
        const parser = FENCE_PARSERS[fence.language];
        if (typeof parser !== 'string' || fence.body.trim() === '') continue;
        // Omitted code and placeholder values keep their lines without becoming syntax errors.
        const omitted = parser === 'bash' ? ':' : '';
        const body = fence.body
            .split('\n')
            .map((line) => (ELLIPSIS_LINE.test(line) ? omitted : line))
            .join('\n')
            .replaceAll(ELLIPSIS_ARGUMENTS, '()')
            .replaceAll(ANGLE_PLACEHOLDER, 'PLACEHOLDER');
        const problem = await readers[parser](body);
        if (problem !== undefined) findings.push({ ...problem, line: fence.line + problem.line });
    }
    return findings;
}

/**
 * Remove an optional current-directory prefix and a trailing directory slash from a prose path token.
 * @param token the authored token
 * @returns the path used for repository comparisons
 */
export function cleanPathToken(token: string): string {
    return token.replace(/^\.\//u, '').replace(/\/$/u, '');
}
