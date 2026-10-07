import ts from 'typescript';
import { CST, Lexer } from 'yaml';
import { visit } from 'unist-util-visit';
import { extensionOf } from '#cli/platform/paths.ts';
import { sqlTokens } from '#cli/parsers/sql/lexer.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { GrammarName } from '#cli/types/parsers/source.ts';
import type { CommentReader, SourceComment } from '#cli/types/parsers/comments.ts';
import { TOML_TOKENS, SCSS_COMMENT_OPENERS } from '#cli/config/parsers/comments.ts';

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

// Only token-leading trivia is eligible: string, template, regular-expression, and JSX text stay source values.
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

// Skip a quoted span before looking for comment openers outside it.
function quotedEnd(line: string, start: number): number {
    const quote = line.charAt(start);
    for (let at = start + 1; at < line.length; at += 1) {
        if (line.charAt(at) === '\\') at += 1;
        else if (line.charAt(at) === quote) return at + 1;
    }
    return line.length;
}

function commentStart(line: string, openers: string[]): number | undefined {
    for (let at = 0; at < line.length; ) {
        if (openers.some((opener) => line.startsWith(opener, at))) return at;
        if (["'", '"', '`'].includes(line.charAt(at))) at = quotedEnd(line, at);
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
        if (!isScalar && ['doc-mode', 'flow-error-end', 'scalar'].includes(kind ?? '')) {
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
        comments.push(commentAt(text, start, end, text.slice(0, start).split('\n').length));
    }
    return comments;
}

// Only Markdown HTML nodes can contain HTML comments. Keep offsets while hiding code examples and prose.
function markdownHtml(text: string): string {
    const masked = text.replaceAll(/[^\r\n]/gu, (character) => ' '.repeat(character.length));
    const pieces: string[] = [];
    let offset = 0;
    visit(fromMarkdown(text), 'html', (node) => {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        if (start === undefined || end === undefined) throw new Error('The Markdown parser omitted source positions.');
        pieces.push(masked.slice(offset, start), text.slice(start, end));
        offset = end;
    });
    pieces.push(masked.slice(offset));
    return pieces.join('');
}

// TOML: a `#` outside a string opens a comment to the end of the line. The token pattern reads strings whole,
// including the triple-quoted ones that span lines, so a `#` inside a value never becomes a comment.
function tomlComments(text: string): SourceComment[] {
    const comments: SourceComment[] = [];
    for (const match of text.matchAll(TOML_TOKENS)) {
        if (!match[0].startsWith('#')) continue;
        const at = match.index;
        comments.push(commentAt(text, at, at + match[0].length, text.slice(0, at).split('\n').length));
    }
    return comments;
}

async function treeComments(grammar: GrammarName, text: string, source: string): Promise<SourceComment[]> {
    // Preserve offsets when the HTML grammar reads the native alternate comment terminator.
    const parsed = grammar === 'html' ? source.replaceAll('--!>', ' -->') : source;
    const tree = await parseSource(grammar, parsed);
    try {
        return tree.rootNode
            .descendantsOfType(['comment', 'multiline_comment'])
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
 * Remove only the closing delimiter that matches the comment syntax.
 * @param text the original comment
 * @returns comment text with its opener and without its terminator or trailing whitespace
 */
export function commentText(text: string): string {
    if (text.startsWith('/*')) return text.replace(/\*\/\s*$/u, '').trimEnd();
    if (text.startsWith('<!--')) return text.replace(/--!?>\s*$/u, '').trimEnd();
    return text.trimEnd();
}

/**
 * Read comment text and line locations for suppression discovery.
 * @param path the source path, whose extension selects its syntax
 * @param text the source text
 * @returns comments in source order, with whether each occupies its line alone
 */
export async function parseComments(path: string, text: string): Promise<SourceComment[]> {
    const reader = COMMENT_READERS.get(extensionOf(path));
    return reader === undefined ? [] : reader(text, path);
}
