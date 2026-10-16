// Reads comments in source files.
import ts from 'typescript';
import { CST, Lexer } from 'yaml';
import { visit } from 'unist-util-visit';
import { parse as parseToml } from 'smol-toml';
import { sqlTokens } from '#cli/parsers/sql/lexer.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { SourcePosition } from '#cli/types/text.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { GrammarName } from '#cli/types/parsers/tree-sitter.ts';
import { tomlRange, tomlSyntax } from '#cli/parsers/toml/comments.ts';
import { convertToSpaces, computePosition } from '#cli/system/text.ts';
import type { CommentReader, SourceComment } from '#cli/types/parsers/comments.ts';

import {
    COMMENT_NODES,
    QUOTE_CHARACTERS,
    HTML_COMMENT_END,
    BLOCK_COMMENT_END,
    YAML_SCALAR_TOKENS,
    SCSS_COMMENT_OPENERS,
    TREE_COMMENT_LANGUAGES,
    HTML_ALTERNATE_COMMENT_END,
} from '#cli/config/parsers/comments.ts';

function commentAt(text: string, start: number, end: number, line: number): SourceComment {
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
function javascriptComments(text: string, path: string): SourceComment[] {
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
            commentAt(text, range.pos, range.end, source.getLineAndCharacterOfPosition(range.pos).line + 1),
        );
}

function commentStart(line: string, openers: readonly string[]): number | undefined {
    for (let at = 0; at < line.length; ) {
        if (openers.some((opener) => line.startsWith(opener, at))) return at;
        if (new Set<string>(QUOTE_CHARACTERS).has(line.charAt(at))) at = quotedEnd(line, at);
        else at += 1;
    }
    return undefined;
}

// Read SCSS comments outside quoted values without adding the format to unrelated syntax tables.
function scssComments(text: string): SourceComment[] {
    return text.split('\n').flatMap((line, index) => {
        const start = commentStart(line, SCSS_COMMENT_OPENERS);
        if (start === undefined) return [];
        return [commentAt(line, start, line.length, index + 1)];
    });
}

// YAML scalar tokens own their whole value, including directive-shaped lines in block and quoted scalars.
function yamlComments(text: string): SourceComment[] {
    const comments: SourceComment[] = [];
    let offset = 0;
    let line = 1;
    let isScalar = false;
    for (const token of new Lexer().lex(text)) {
        const kind = CST.tokenType(token);
        if (!isScalar && new Set<string | undefined>(YAML_SCALAR_TOKENS).has(kind ?? '')) {
            isScalar = kind === 'scalar';
            continue;
        }
        if (!isScalar && kind === 'comment') {
            comments.push(commentAt(text, offset, offset + token.length, line));
        }
        isScalar = false;
        offset += token.length;
        line += token.split('\n').length - 1;
    }
    return comments;
}

function sqlComments(text: string): SourceComment[] {
    const comments: SourceComment[] = [];
    for (const { start, end, kind } of sqlTokens(text)) {
        if (kind !== 'line-comment' && kind !== 'block-comment') continue;
        comments.push(commentAt(text, start, end, computePosition(text, start).line));
    }
    return comments;
}

// Only Markdown HTML nodes can contain HTML comments. Keep offsets while hiding code examples and prose.
function markdownHtml(text: string): string {
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

// Native TOML comments retain the source positions of strings and multiline values.
function tomlComments(text: string): SourceComment[] {
    return tomlSyntax(text, parseToml(text)).comments.map((comment) => {
        const [start, end] = tomlRange(comment);
        return commentAt(text, start, end, comment.loc.start.line);
    });
}

async function treeComments(grammar: GrammarName, text: string, source: string): Promise<SourceComment[]> {
    // Preserve offsets when the HTML grammar reads the alternate comment terminator.
    const parsed = grammar === 'html' ? source.replaceAll(HTML_ALTERNATE_COMMENT_END, ' -->') : source;
    const tree = await parseSource(grammar, parsed);
    try {
        return tree.rootNode
            .descendantsOfType([...COMMENT_NODES])
            .map((node) => commentAt(text, node.startIndex, node.endIndex, node.startPosition.row + 1));
    } finally {
        tree.delete();
    }
}

const COMMENT_READERS = new Map<string, CommentReader>([
    ['.ts', javascriptComments],
    ['.mts', javascriptComments],
    ['.cts', javascriptComments],
    ['.tsx', javascriptComments],
    ['.js', javascriptComments],
    ['.mjs', javascriptComments],
    ['.cjs', javascriptComments],
    ['.jsx', javascriptComments],
    ['.toml', tomlComments],
    ['.yaml', yamlComments],
    ['.yml', yamlComments],
    ['.sql', sqlComments],
    ['.pgsql', sqlComments],
    ['.psql', sqlComments],
    ['.scss', scssComments],
    ['.py', (text) => treeComments('python', text, text)],
    ['.sh', (text) => treeComments('bash', text, text)],
    ['.bash', (text) => treeComments('bash', text, text)],
    ['.zsh', (text) => treeComments('bash', text, text)],
    ['.swift', (text) => treeComments('swift', text, text)],
    ['.html', (text) => treeComments('html', text, text)],
    ['.htm', (text) => treeComments('html', text, text)],
    ['.md', (text) => treeComments('html', text, markdownHtml(text))],
    ['.mdx', (text) => treeComments('html', text, markdownHtml(text))],
    ['.css', (text) => treeComments('css', text, text)],
]);

/**
 * Skip a quoted span before looking for comment openers outside it.
 * @param line the source line.
 * @param start the first source offset.
 * @returns the offset after the quoted value.
 */
export function quotedEnd(line: string, start: number): number {
    const quote = line.charAt(start);
    for (let at = start + 1; at < line.length; at += 1) {
        if (line.charAt(at) === '\\') at += 1;
        else if (line.charAt(at) === quote) return at + 1;
    }
    return line.length;
}

/**
 * Remove only the closing delimiter that matches the comment syntax.
 * @param text the original comment.
 * @returns comment text with its opener and without its terminator or trailing whitespace.
 */
export function commentText(text: string): string {
    if (text.startsWith('/*')) return text.replace(BLOCK_COMMENT_END, '').trimEnd();
    if (text.startsWith('<!--')) return text.replace(HTML_COMMENT_END, '').trimEnd();
    return text.trimEnd();
}

/**
 * Read comment text and line locations for suppression discovery.
 * @param path the source path or grammar name that selects its syntax.
 * @param text the source text.
 * @returns comments in source order, with whether each occupies its line alone.
 */
export async function parseComments(path: string, text: string): Promise<SourceComment[]> {
    const grammar = TREE_COMMENT_LANGUAGES.find((language) => language === path);
    if (grammar !== undefined) return treeComments(grammar, text, text);
    const reader = COMMENT_READERS.get(extractExtension(path));
    return reader === undefined ? [] : reader(text, path);
}
