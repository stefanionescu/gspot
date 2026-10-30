import { CST, Lexer } from 'yaml';
import { visit } from 'unist-util-visit';
import type { Node } from 'web-tree-sitter';
import { extractExtension } from '#cli/system/paths.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { listSqlTokens } from '#cli/parsers/code/sql.ts';
import { SCRIPT_TAG } from '#cli/config/repository/files.ts';
import { getPosition, replaceRanges } from '#cli/system/text.ts';
import type { TextRange, SourcePosition } from '#cli/types/text.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/system.ts';
import { parseSource, findGrammarByExtension } from '#cli/parsers/code/grammars.ts';
import { getTomlRange, parseTomlFile, parseTomlSyntax } from '#cli/parsers/formats/toml.ts';
import type { GrammarName, CommentParser, SourceComment, ComponentScript } from '#cli/types/parsers/code.ts';

import {
    MDX_ESM,
    MDX_COMMENT,
    TSX_LANGUAGES,
    COMMENT_NODES,
    NOT_LINE_BREAK,
    ASTRO_EXTENSION,
    HTML_COMMENT_END,
    BLOCK_COMMENT_END,
    ASTRO_FRONT_MATTER,
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
    const masked = text.replaceAll(NOT_LINE_BREAK, (character) => ' '.repeat(character.length));
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
    const masked = text.replaceAll(NOT_LINE_BREAK, (character) => ' '.repeat(character.length));
    const front = path.endsWith(ASTRO_EXTENSION) ? ASTRO_FRONT_MATTER.exec(text) : null;
    const markup = front === null ? text : masked.slice(0, front[0].length) + text.slice(front[0].length);
    using tree = await parseSource('html', markup);
    const scripts = tree.rootNode
        .descendantsOfType('script_element')
        .flatMap((element) => listComponentScripts(element, text, masked));
    if (front !== null) {
        const start = text.indexOf('\n') + 1;
        scripts.push({
            grammar: 'typescript',
            source: replaceRanges(masked, text, [{ start, end: start + (front[1] as string).length }]),
        });
    }
    const comments: SourceComment[] = [];
    for (const { grammar, source } of scripts) comments.push(...(await parseGrammarComments(grammar, source)));
    return [...comments, ...(await parseGrammarComments('html', markup))].toSorted(
        (left, right) => left.line - right.line,
    );
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
    ...['.md'].map((extension): [string, CommentParser] => [
        extension,
        (text) => parseGrammarComments('html', text, extractMarkdownHtml(text)),
    ]),
    ['.mdx', parseMdxComments],
    ['.css', (text) => parseGrammarComments('css', text)],
]);

async function parseGrammarComments(grammar: GrammarName, text: string, source = text): Promise<SourceComment[]> {
    const parsed = grammar === 'html' ? source.replaceAll(HTML_ALTERNATE_COMMENT_END, ' -->') : source;
    using tree = await parseSource(grammar, parsed);
    return tree.rootNode
        .descendantsOfType([...COMMENT_NODES])
        .map((node) => buildComment(text, node.startIndex, node.endIndex, node.startPosition.row + 1));
}

/**
Remove only the closing delimiter that matches the comment syntax.

@param text the original comment.
@returns comment text with its opener and without its terminator or trailing whitespace.
*/
export function stripCommentEnd(text: string): string {
    if (text.startsWith('/*')) return text.replace(BLOCK_COMMENT_END, '').trimEnd();
    return text.startsWith('<!--') ? text.replace(HTML_COMMENT_END, '').trimEnd() : text.trimEnd();
}

/**
Read the text and line of each comment.

@param path the file, whose name selects the syntax.
@param text the source contents.
@param tags the file tags, which identify scripts without a known extension.
@returns comments in source order.
*/
export async function parseComments(path: string, text: string, tags: readonly string[]): Promise<SourceComment[]> {
    const lowerPath = path.toLowerCase();
    if (DECLARATION_EXTENSIONS.some((extension) => lowerPath.endsWith(extension)))
        return parseGrammarComments('typescript', text);
    let scriptGrammar: GrammarName | undefined;
    if (tags.includes(SCRIPT_TAG)) scriptGrammar = 'bash';
    else if (tags.includes('python')) scriptGrammar = 'python';
    const grammar = findGrammarByExtension(lowerPath) ?? scriptGrammar;
    if (grammar !== undefined) return parseGrammarComments(grammar, text);
    const parser = COMMENT_PARSERS.get(extractExtension(path));
    return parser === undefined ? [] : parser(text, path);
}

/**
Replace comments with spaces while preserving source offsets and line breaks.

@param grammar the grammar of the source.
@param text the source contents.
@returns source text with comment contents masked.
*/
export async function maskGrammarComments(grammar: GrammarName | 'sql', text: string): Promise<string> {
    const ranges: TextRange[] = [];
    if (grammar === 'sql') {
        ranges.push(
            ...[...listSqlTokens(text)].filter((token) => ['line-comment', 'block-comment'].includes(token.kind)),
        );
    } else {
        using tree = await parseSource(grammar, text);
        for (const node of tree.rootNode.descendantsOfType([...COMMENT_NODES]))
            ranges.push({ start: node.startIndex, end: node.endIndex });
    }
    return maskCommentRanges(text, ranges);
}

async function parseMdxComments(text: string): Promise<SourceComment[]> {
    let masked = text;
    const ranges: TextRange[] = [];
    visit(fromMarkdown(text), (node) => {
        if (node.type !== 'code' && node.type !== 'inlineCode') return;
        const { start, end } = node.position as SourcePosition;
        ranges.push({ start: start.offset, end: end.offset });
    });
    const blank = text.replaceAll(NOT_LINE_BREAK, (character) => ' '.repeat(character.length));
    masked = replaceRanges(masked, blank, ranges).replaceAll(MDX_ESM, (segment) =>
        segment.replaceAll(NOT_LINE_BREAK, (character) => ' '.repeat(character.length)),
    );
    const expressions = [...masked.matchAll(MDX_COMMENT)].map((match) => {
        const start = match.index;
        const comment = buildComment(text, start, start + match[0].length, getPosition(text, start).line);
        return { ...comment, text: match[0].slice(1, -1) };
    });
    const markup = await parseGrammarComments('html', text, extractMarkdownHtml(text));
    return [...expressions, ...markup].toSorted((left, right) => left.line - right.line);
}

function maskCommentRanges(text: string, ranges: TextRange[]): string {
    let position = 0;
    const pieces: string[] = [];
    for (const { start, end } of ranges.toSorted((left, right) => left.start - right.start)) {
        if (start < position) continue;
        pieces.push(
            text.slice(position, start),
            text.slice(start, end).replaceAll(NOT_LINE_BREAK, (character) => ' '.repeat(character.length)),
        );
        position = end;
    }
    return pieces.join('') + text.slice(position);
}

function listComponentScripts(element: Node, text: string, masked: string): ComponentScript[] {
    const language = element.namedChildren
        .find((node) => node.type === 'start_tag')
        ?.text.match(/\blang\s*=\s*["'](?<language>[^"']+)["']/u)?.groups?.['language'];
    const grammar = TSX_LANGUAGES.includes(language ?? '') ? 'tsx' : 'typescript';
    return element.namedChildren
        .filter((child) => child.type === 'raw_text')
        .map((node) => ({
            grammar,
            source: replaceRanges(masked, text, [{ start: node.startIndex, end: node.endIndex }]),
        }));
}
