import ts from 'typescript';
import { CST, Lexer } from 'yaml';
import { visit } from 'unist-util-visit';
import { extractExtension } from '#cli/system/paths.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { listSqlTokens } from '#cli/parsers/code/sql.ts';
import { getPosition, spliceRanges } from '#cli/system/text.ts';
import { NOT_LINE_BREAK } from '#cli/config/parsers/code/bash.ts';
import type { TextRange, SourcePosition } from '#cli/types/text.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { SCRIPT_TAG } from '#cli/config/repository/files/classify.ts';
import type { GrammarName } from '#cli/types/parsers/code/grammars.ts';
import { parseSource, findGrammarByExtension } from '#cli/parsers/code/grammars.ts';
import type { CommentParser, SourceComment } from '#cli/types/parsers/code/comments.ts';
import { getTomlRange, parseTomlFile, parseTomlSyntax } from '#cli/parsers/formats/toml.ts';

import {
    COMMENT_NODES,
    HTML_COMMENT_END,
    BLOCK_COMMENT_END,
    ASTRO_FRONT_MATTER,
    YAML_SCALAR_TOKENS,
    HTML_ALTERNATE_COMMENT_END,
} from '#cli/config/parsers/code/comments.ts';

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
    return comments
        .values()
        .toArray()
        .toSorted((left, right) => left.pos - right.pos)
        .map((range) =>
            buildComment(text, range.pos, range.end, source.getLineAndCharacterOfPosition(range.pos).line + 1),
        );
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
    for (const { start, end, kind } of listSqlTokens(text)) {
        if (kind !== 'line-comment' && kind !== 'block-comment') continue;
        comments.push(buildComment(text, start, end, getPosition(text, start).line));
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
    return spliceRanges(masked, text, ranges);
}

function parseTomlComments(text: string, path: string): SourceComment[] {
    return parseTomlSyntax(text, parseTomlFile(path, text)).comments.map((comment) => {
        const [start, end] = getTomlRange(comment);
        return buildComment(text, start, end, comment.loc.start.line);
    });
}

async function parseComponentComments(text: string, path: string): Promise<SourceComment[]> {
    const masked = text.replaceAll(NOT_LINE_BREAK, (character) => ' '.repeat(character.length));
    const front = path.endsWith('.astro') ? ASTRO_FRONT_MATTER.exec(text) : null;
    const markup = front === null ? text : masked.slice(0, front[0].length) + text.slice(front[0].length);
    const tree = await parseSource('html', markup);
    let script: string;
    try {
        const regions = tree.rootNode
            .descendantsOfType('script_element')
            .flatMap((node) => node.namedChildren.filter((child) => child.type === 'raw_text'))
            .map((node) => ({ start: node.startIndex, end: node.endIndex }));
        if (front !== null) {
            const start = text.indexOf('\n') + 1;
            regions.unshift({ start, end: start + (front[1] as string).length });
        }
        script = spliceRanges(masked, text, regions);
    } finally {
        tree.delete();
    }
    return [...parseJavascriptComments(script, `${path}.ts`), ...(await parseGrammarComments('html', markup))].toSorted(
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
    ['.html', parseGrammarComments.bind(undefined, 'html')],
    ['.htm', parseGrammarComments.bind(undefined, 'html')],
    ...['.md', '.mdx'].map((extension): [string, CommentParser] => [
        extension,
        (text) =>
            parseSyntaxComments('html', extractMarkdownHtml(text).replaceAll(HTML_ALTERNATE_COMMENT_END, ' -->'), text),
    ]),
    ['.css', parseGrammarComments.bind(undefined, 'css')],
]);

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
Read comments in one explicit grammar.

@param grammar the tree-sitter language to use.
@param text the source contents.
@returns comments in source order.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The comment parsers table and 3 other calls share it.
export async function parseGrammarComments(grammar: GrammarName, text: string): Promise<SourceComment[]> {
    const parsed = grammar === 'html' ? text.replaceAll(HTML_ALTERNATE_COMMENT_END, ' -->') : text;
    return parseSyntaxComments(grammar, parsed, text);
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
Read comment text and line locations for suppression discovery.

@param path the file, whose name selects the syntax.
@param text the source contents.
@param tags the file tags, which identify scripts without a known extension.
@returns comments in source order, with whether each occupies its line alone.
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
        return ['javascript', 'typescript', 'tsx'].includes(grammar)
            ? parseJavascriptComments(text, path)
            : parseGrammarComments(grammar, text);
    }
    const parser = COMMENT_PARSERS.get(extractExtension(path));
    return parser === undefined ? [] : parser(text, path);
}
