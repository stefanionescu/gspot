import { CST, Lexer } from 'yaml';
import { visit } from 'unist-util-visit';
import type { TextRange } from '#cli/types/system.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { listSqlTokens } from '#cli/parsers/code/sql.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { parseComponentSources } from '#cli/parsers/code/javascript.ts';
import { parseSource, findGrammarByExtension } from '#cli/parsers/code/grammars.ts';
import { getTomlRange, parseTomlSyntax } from '#cli/parsers/formats/toml/syntax.ts';
import { blankText, getPosition, replaceRanges } from '#cli/system/text/positions.ts';
import type { ParseCache, GrammarName, CommentParser, SourceComment, SourcePosition } from '#cli/types/parsers.ts';

import {
    MDX_ESM,
    MDX_COMMENT,
    TAG_GRAMMARS,
    COMMENT_NODES,
    HTML_COMMENT_END,
    BLOCK_COMMENT_END,
    YAML_SCALAR_TOKENS,
    HTML_ALTERNATE_COMMENT_END,
} from '#cli/config/parsers/code.ts';

function buildComment(text: string, start: number, end: number, line: number): SourceComment {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const newline = text.indexOf('\n', end);
    const lineEnd = newline === -1 ? text.length : newline;
    return {
        line,
        text: text.slice(start, end),
        standalone: text.slice(lineStart, start).trim() === '' && text.slice(end, lineEnd).trim() === '',
    };
}

function parseYamlComments(text: string): SourceComment[] {
    const comments: SourceComment[] = [];
    let offset = 0;
    let line = 1;
    let isScalar = false;
    const tokens = new Lexer().lex(text);
    for (const token of tokens) {
        const kind = CST.tokenType(token);
        if (!isScalar && YAML_SCALAR_TOKENS.has(kind ?? '')) {
            isScalar = kind === 'scalar';
            continue;
        }
        if (!isScalar && kind === 'comment') {
            comments.push(buildComment(text, offset, offset + token.length, line));
        }
        isScalar = false;
        offset += token.length;
        line += token.split('\n').length - 1;
    }
    return comments;
}

function parseSqlComments(text: string): SourceComment[] {
    const comments: SourceComment[] = [];
    let position = 0;
    let line = 1;
    for (const { start, end, kind } of listSqlTokens(text)) {
        line += text.slice(position, start).split('\n').length - 1;
        position = start;
        if (kind !== 'line-comment' && kind !== 'block-comment') continue;
        comments.push(buildComment(text, start, end, line));
    }
    return comments;
}

function extractMarkdownHtml(text: string): string {
    const masked = blankText(text);
    const ranges: TextRange[] = [];
    visit(fromMarkdown(text), 'html', (node) => {
        const { start, end } = node.position as SourcePosition;
        ranges.push({ start: start.offset, end: end.offset });
    });
    return replaceRanges(masked, text, ranges);
}

function parseTomlComments(text: string, path: string): SourceComment[] {
    return parseTomlSyntax(text, parseTomlFile(path, text)).comments.map((comment) => {
        const [start, end] = getTomlRange(comment);
        return buildComment(text, start, end, comment.loc.start.line);
    });
}

async function parseComponentComments(text: string, path: string): Promise<SourceComment[]> {
    const { markup, scripts } = await parseComponentSources(text, path);
    const comments: SourceComment[] = [];
    for (const { grammar, source } of scripts) comments.push(...(await parseGrammarComments(grammar, source)));
    return [...comments, ...(await parseGrammarComments('html', markup))].toSorted(
        (left, right) => left.line - right.line,
    );
}

async function parseGrammarComments(
    grammar: GrammarName,
    text: string,
    { source = text, cache }: { source?: string; cache?: ParseCache | undefined } = {},
): Promise<SourceComment[]> {
    const parsed = grammar === 'html' ? source.replaceAll(HTML_ALTERNATE_COMMENT_END, ' -->') : source;
    using tree = await parseSource(grammar, parsed, cache);
    return tree.rootNode
        .descendantsOfType([...COMMENT_NODES])
        .map((node) => buildComment(text, node.startIndex, node.endIndex, node.startPosition.row + 1));
}

/**
Replace comments with spaces while preserving source offsets and line breaks.
*/
async function maskGrammarComments(grammar: GrammarName | 'sql', text: string, cache: ParseCache): Promise<string> {
    const ranges: TextRange[] = [];
    if (grammar === 'sql') {
        ranges.push(
            ...[...listSqlTokens(text)].filter((token) => ['line-comment', 'block-comment'].includes(token.kind)),
        );
    } else {
        using tree = await parseSource(grammar, text, cache);
        const comments = tree.rootNode.descendantsOfType([...COMMENT_NODES]);
        for (const node of comments) ranges.push({ start: node.startIndex, end: node.endIndex });
    }
    return replaceRanges(text, blankText(text), ranges);
}

async function parseMdxComments(text: string): Promise<SourceComment[]> {
    let masked = text;
    const ranges: TextRange[] = [];
    visit(fromMarkdown(text), (node) => {
        if (node.type !== 'code' && node.type !== 'inlineCode') return;
        const { start, end } = node.position as SourcePosition;
        ranges.push({ start: start.offset, end: end.offset });
    });
    masked = replaceRanges(masked, blankText(text), ranges).replaceAll(MDX_ESM, (segment) => blankText(segment));
    const expressions = masked
        .matchAll(MDX_COMMENT)
        .map((match) => {
            const start = match.index;
            const comment = buildComment(text, start, start + match[0].length, getPosition(text, start).line);
            return { ...comment, text: match[0].slice(1, -1) };
        })
        .toArray();
    const markup = await parseGrammarComments('html', text, { source: extractMarkdownHtml(text) });
    return [...expressions, ...markup].toSorted((left, right) => left.line - right.line);
}

const COMMENT_PARSERS = new Map<string, CommentParser>([
    ['.vue', parseComponentComments],
    ['.svelte', parseComponentComments],
    ['.astro', parseComponentComments],
    ['.toml', parseTomlComments],
    ['.yaml', parseYamlComments],
    ['.yml', parseYamlComments],
    ['.sql', parseSqlComments],
    ['.pgsql', parseSqlComments],
    ['.psql', parseSqlComments],
    ['.html', (text) => parseGrammarComments('html', text)],
    ['.htm', (text) => parseGrammarComments('html', text)],
    ['.md', (text) => parseGrammarComments('html', text, { source: extractMarkdownHtml(text) })],
    ['.mdx', parseMdxComments],
    ['.css', (text) => parseGrammarComments('css', text)],
]);

export function stripCommentEnd(text: string): string {
    if (text.startsWith('/*')) return text.replace(BLOCK_COMMENT_END, '').trimEnd();
    return text.startsWith('<!--') ? text.replace(HTML_COMMENT_END, '').trimEnd() : text.trimEnd();
}

export async function parseComments(
    path: string,
    text: string,
    tags: readonly string[],
    cache?: ParseCache,
): Promise<SourceComment[]> {
    const lowerPath = path.toLowerCase();
    if (DECLARATION_EXTENSIONS.includes(extractExtension(lowerPath)))
        return parseGrammarComments('typescript', text, { cache });
    const grammar =
        findGrammarByExtension(lowerPath) ?? Object.entries(TAG_GRAMMARS).find(([tag]) => tags.includes(tag))?.[1];
    if (grammar !== undefined) return parseGrammarComments(grammar, text, { cache });
    const parser = COMMENT_PARSERS.get(extractExtension(path));
    return parser === undefined ? [] : parser(text, path);
}

export async function countCodeLines(text: string, grammar: GrammarName | 'sql', cache: ParseCache): Promise<number> {
    const code = await maskGrammarComments(grammar, text, cache);
    return code.split('\n').filter((line) => line.trim() !== '').length;
}
