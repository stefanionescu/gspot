// The tree-sitter parsers, built once per process from the grammar files in the package.
import { readFileSync } from 'node:fs';
import { memo } from '#cli/platform/memo.ts';
import { wasmPath } from '#cli/platform/assets.ts';
import { readSource } from '#cli/platform/source.ts';
import { Parser, Language, type Tree } from 'web-tree-sitter';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';

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
export async function visitParsed<Value>(
    input: SourceInput,
    read: (input: SourceInput) => Promise<Value>,
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
