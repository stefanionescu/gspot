import ts from 'typescript';
import { CST, Lexer } from 'yaml';
import { readFileSync } from 'node:fs';
import { visit } from 'unist-util-visit';
import { memo } from '#cli/platform/memo.ts';
import { sqlTokens } from '#cli/parsers/sql/lexer.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { extensionOf } from '#cli/platform/contracts.ts';
import { Parser, Language, type Tree } from 'web-tree-sitter';
import { wasmPath, readSource } from '#cli/platform/root/public.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';
import type { CommentReader, SourceComment } from '#cli/types/parsers/comments.ts';
import { TOML_TOKENS, SCSS_COMMENT_OPENERS } from '#cli/config/parsers/comments.ts';

import type {
    ParseReads,
    GrammarName,
    ParsedVisit,
    ParserState,
    SourceInput,
    ParsedSource,
    ParsedSourceInput,
} from '#cli/types/parsers/source.ts';

const PARSED_MEMO = {
    create: () => new WeakMap<object, WeakMap<DisposableStack, Map<string, Promise<unknown>>>>(),
};

const TREE_MEMO = { create: () => new Map<string, Tree>() };

const state: ParserState = {
    runtime: undefined,
    parsers: new Map(),
};

async function build(name: GrammarName): Promise<Parser> {
    state.runtime ??= Parser.init({ wasmBinary: readFileSync(wasmPath('web-tree-sitter.wasm')) });
    await state.runtime;
    const language = await Language.load(readFileSync(wasmPath(`${name}.wasm`)));
    const parser = new Parser();
    parser.setLanguage(language);
    return parser;
}

// Reject a failed native parse at its boundary, before any reader receives the tree.
function parseTree(parser: Parser, name: GrammarName, text: string): Tree {
    const tree = parser.parse(text);
    if (tree === null) throw new Error(`The ${name} parser returned no tree.`);
    return tree;
}

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
 * The parser for a grammar, built on first use.
 * @param name the grammar
 * @returns the parser
 */
export function parserFor(name: GrammarName): Promise<Parser> {
    let parser = state.parsers.get(name);
    if (parser === undefined) {
        parser = build(name);
        state.parsers.set(name, parser);
    }
    return parser;
}

/**
 * Shares a run-owned parse while giving each reader its own disposable tree handle.
 * @param name the grammar that gives the source its meaning.
 * @param text the exact source to parse.
 * @param context execution reads and their existing resource owner, when running checks.
 * @returns a caller-owned tree copy; throws when the native parser produces no tree.
 */
export async function parseSource(name: GrammarName, text: string, context?: ParseReads): Promise<Tree> {
    const parser = await parserFor(name);
    if (context?.resources === undefined) return parseTree(parser, name, text);
    const trees = memo(context.reads, TREE_MEMO);
    const key = JSON.stringify([name, text]);
    const held = trees.get(key);
    if (held !== undefined) return held.copy();
    const tree = parseTree(parser, name, text);
    trees.set(key, tree);
    context.resources.defer(() => {
        trees.delete(key);
        tree.delete();
    });
    return tree.copy();
}

/**
 * Reads selected files and lends each parsed tree to a synchronous visitor, then releases its handle.
 * @param input the repository reads and files with their selected grammars
 * @param visit the source inspection; native nodes must not escape this callback
 * @returns when all selected sources have been inspected
 */
export async function visitParsedSources(
    input: ParsedSourceInput,
    visit: (source: ParsedSource) => void,
): Promise<void> {
    for (const file of input.files) {
        const text = readSource(input.root, file.path, input.reads).toString('utf8');
        const tree = await parseSource(file.grammar, text, input);
        try {
            visit({ path: file.path, text, rootNode: tree.rootNode });
        } finally {
            tree.delete();
        }
    }
}

/**
 * The grammar of a language configuration, with TSX syntax for .tsx files.
 * @param path the file path
 * @param language the language configuration the file belongs to
 * @returns the grammar, or undefined for declaration files and languages without a grammar
 */
export function grammarFor(path: string, language: string): GrammarName | undefined {
    if (DECLARATION_EXTENSIONS.some((extension) => path.endsWith(extension))) return undefined;
    if (language === 'bash') return 'bash';
    if (language === 'swift') return 'swift';
    if (language === 'python') return 'python';
    if (language === 'javascript') return 'javascript';
    if (language !== 'typescript') return undefined;
    return path.endsWith('.tsx') ? 'tsx' : 'typescript';
}

/**
 * Lend selected observations until a standalone handle or their run owner is disposed.
 * @param input the selected paths, source reads, and optional run owner.
 * @param read the parser that owns the observations.
 * @param dispose the operation that releases the observations.
 * @returns a handle. Its value must stay within its ownership lifetime.
 */
export async function visitParsed<Value, Input extends SourceInput>(
    input: Input,
    read: (input: Input) => Promise<Value>,
    dispose: (value: Value) => void,
): Promise<ParsedVisit<Value>> {
    if (input.resources === undefined) {
        const value = await read(input);
        return {
            value,
            [Symbol.dispose]() {
                dispose(value);
            },
        };
    }
    const readers = memo(input.reads, PARSED_MEMO);
    let owners = readers.get(read);
    if (owners === undefined) {
        owners = new WeakMap();
        readers.set(read, owners);
    }
    let entries = owners.get(input.resources);
    if (entries === undefined) {
        entries = new Map();
        owners.set(input.resources, entries);
    }
    const key = JSON.stringify([input.root, input.files.map((file) => file.path)]);
    let pending = entries.get(key);
    if (pending === undefined) {
        pending = read(input);
        entries.set(key, pending);
        try {
            // Only this reader creates its entries; its return type owns the parsed value.
            const value = (await pending) as Value;
            input.resources.defer(() => {
                entries.delete(key);
                dispose(value);
            });
        } catch (error) {
            entries.delete(key);
            throw error;
        }
    }
    return { value: (await pending) as Value, [Symbol.dispose]() {} };
}

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
