// Reads comments in source files.
import ts from 'typescript';
import { CST, Lexer } from 'yaml';
import { visit } from 'unist-util-visit';
import { extractExtension } from '#cli/system/paths.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { SourcePosition } from '#cli/types/text.ts';
import { listSqlTokens } from '#cli/parsers/sql/lexer.ts';
import { parseTomlFile } from '#cli/parsers/toml/document.ts';
import { SCRIPT_TAG } from '#cli/config/repository/inventory.ts';
import type { GrammarName } from '#cli/types/parsers/grammars.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { convertToSpaces, computePosition } from '#cli/system/text.ts';
import { getTomlRange, parseTomlSyntax } from '#cli/parsers/toml/comments.ts';
import { parseSource, findGrammarByExtension } from '#cli/parsers/grammars.ts';
import type { CommentReader, SourceComment } from '#cli/types/parsers/comments.ts';

import {
    COMMENT_NODES,
    QUOTE_CHARACTERS,
    HTML_COMMENT_END,
    BLOCK_COMMENT_END,
    YAML_SCALAR_TOKENS,
    SCSS_COMMENT_OPENERS,
    HTML_ALTERNATE_COMMENT_END,
} from '#cli/config/parsers/comments.ts';

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

// Read only token-leading trivia: string, template, regular-expression, and JavaScript XML text stay source values.
function parseJavascriptComments(text: string, path: string): SourceComment[] {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest);
    const comments = new Map<number, ts.CommentRange>();
    const visitNode = (node: ts.Node): void => {
        if ([ts.SyntaxKind.JsxText, ts.SyntaxKind.JsxTextAllWhiteSpaces, ts.SyntaxKind.JSDoc].includes(node.kind))
            return;
        const children = node.getChildren(source);
        if (children.length > 0) {
            for (const child of children) visitNode(child);
            return;
        }
        const start = node.getFullStart();
        const end = node.getStart(source);
        for (const range of [
            ...(ts.getLeadingCommentRanges(text, start) ?? []),
            ...(ts.getTrailingCommentRanges(text, start) ?? []),
        ])
            if (range.end <= end) comments.set(range.pos, range);
    };
    visitNode(source);
    return [...comments.values()]
        .toSorted((left, right) => left.pos - right.pos)
        .map((range) =>
            buildComment(text, range.pos, range.end, source.getLineAndCharacterOfPosition(range.pos).line + 1),
        );
}

function findCommentStart(line: string, openers: readonly string[]): number | undefined {
    for (let at = 0; at < line.length; ) {
        if (openers.some((opener) => line.startsWith(opener, at))) return at;
        if (QUOTE_CHARACTERS.has(line.charAt(at))) at = findQuotedEnd(line, at);
        else at += 1;
    }
    return undefined;
}

// Read SCSS comments outside quoted values without adding the format to unrelated syntax tables.
function parseScssComments(text: string): SourceComment[] {
    return text.split('\n').flatMap((line, index) => {
        const start = findCommentStart(line, SCSS_COMMENT_OPENERS);
        if (start === undefined) return [];
        return [buildComment(line, start, line.length, index + 1)];
    });
}

// YAML scalar tokens own their whole value, including directive-shaped lines in block and quoted scalars.
function parseYamlComments(text: string): SourceComment[] {
    const comments: SourceComment[] = [];
    let offset = 0;
    let line = 1;
    let isScalar = false;
    for (const token of new Lexer().lex(text)) {
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
    for (const { start, end, kind } of listSqlTokens(text)) {
        if (kind !== 'line-comment' && kind !== 'block-comment') continue;
        comments.push(buildComment(text, start, end, computePosition(text, start).line));
    }
    return comments;
}

// Only Markdown HTML nodes can contain HTML comments. Keep offsets while hiding code examples and prose.
function extractMarkdownHtml(text: string): string {
    const masked = convertToSpaces(text);
    const pieces: string[] = [];
    let offset = 0;
    visit(fromMarkdown(text), 'html', (node) => {
        const { start, end } = node.position as SourcePosition;
        pieces.push(masked.slice(offset, start.offset), text.slice(start.offset, end.offset));
        offset = end.offset;
    });
    pieces.push(masked.slice(offset));
    return pieces.join('');
}

// TOML comments retain the source positions of strings and multiline values.
function parseTomlComments(text: string, path: string): SourceComment[] {
    return parseTomlSyntax(text, parseTomlFile(path, text)).comments.map((comment) => {
        const [start, end] = getTomlRange(comment);
        return buildComment(text, start, end, comment.loc.start.line);
    });
}

// The HTML parse of Markdown keeps original prose for standalone-comment classification.
async function parseMarkdownComments(text: string): Promise<SourceComment[]> {
    const source = extractMarkdownHtml(text).replaceAll(HTML_ALTERNATE_COMMENT_END, ' -->');
    return parseSyntaxComments('html', source, text);
}

const COMMENT_PARSERS = new Map<string, CommentReader>([
    ['.toml', parseTomlComments],
    ['.yaml', parseYamlComments],
    ['.yml', parseYamlComments],
    ['.sql', parseSqlComments],
    ['.pgsql', parseSqlComments],
    ['.psql', parseSqlComments],
    ['.scss', parseScssComments],
    ['.html', parseGrammarComments.bind(undefined, 'html')],
    ['.htm', parseGrammarComments.bind(undefined, 'html')],
    ['.md', parseMarkdownComments],
    ['.mdx', parseMarkdownComments],
    ['.css', parseGrammarComments.bind(undefined, 'css')],
]);

// Parse retained syntax while classifying each comment against its original text.
async function parseSyntaxComments(grammar: GrammarName, source: string, text: string): Promise<SourceComment[]> {
    const tree = await parseSource(grammar, source);
    try {
        return tree.rootNode
            .descendantsOfType([...COMMENT_NODES])
            .map((node) => buildComment(text, node.startIndex, node.endIndex, node.startPosition.row + 1));
    } finally {
        tree.delete();
    }
}

/**
 * Read comments in one explicit grammar.
 *
 * @param grammar the tree-sitter language to use.
 * @param text the source contents.
 * @returns comments in source order.
 */
export async function parseGrammarComments(grammar: GrammarName, text: string): Promise<SourceComment[]> {
    // Preserve offsets when the HTML grammar reads the alternate comment terminator.
    const parsed = grammar === 'html' ? text.replaceAll(HTML_ALTERNATE_COMMENT_END, ' -->') : text;
    return parseSyntaxComments(grammar, parsed, text);
}

/**
 * Skip a quoted span before looking for comment openers outside it.
 *
 * @param line the source to scan.
 * @param start the first source offset.
 * @returns the offset after the quoted value.
 */
export function findQuotedEnd(line: string, start: number): number {
    const quote = line.charAt(start);
    for (let at = start + 1; at < line.length; at += 1) {
        if (line.charAt(at) === '\\') at += 1;
        else if (line.charAt(at) === quote) return at + 1;
    }
    return line.length;
}

/**
 * Remove only the closing delimiter that matches the comment syntax.
 *
 * @param text the original comment.
 * @returns comment text with its opener and without its terminator or trailing whitespace.
 */
export function stripCommentEnd(text: string): string {
    if (text.startsWith('/*')) return text.replace(BLOCK_COMMENT_END, '').trimEnd();
    if (text.startsWith('<!--')) return text.replace(HTML_COMMENT_END, '').trimEnd();
    return text.trimEnd();
}

/**
 * Read comment text and line locations for suppression discovery.
 *
 * @param path the file, whose name selects the syntax.
 * @param text the source contents.
 * @param tags the file tags, which identify scripts without a known extension.
 * @returns comments in source order, with whether each occupies its line alone.
 */
export async function parseComments(path: string, text: string, tags: readonly string[]): Promise<SourceComment[]> {
    const lowerPath = path.toLowerCase();
    if (DECLARATION_EXTENSIONS.some((extension) => lowerPath.endsWith(extension)))
        return parseJavascriptComments(text, path);
    let scriptGrammar: GrammarName | undefined;
    if (tags.includes(SCRIPT_TAG)) scriptGrammar = 'bash';
    else if (tags.includes('python')) scriptGrammar = 'python';
    const grammar = findGrammarByExtension(lowerPath) ?? scriptGrammar;
    if (grammar !== undefined) {
        if (['javascript', 'typescript', 'tsx'].includes(grammar)) return parseJavascriptComments(text, path);
        return parseGrammarComments(grammar, text);
    }
    const parser = COMMENT_PARSERS.get(extractExtension(path));
    return parser === undefined ? [] : parser(text, path);
}
