// Reads grammars and shares source parses within a run.
import { readFileSync } from 'node:fs';
import { wasmPath } from '#cli/system/assets.ts';
import { memo, readSource } from '#cli/system/file-reads.ts';
import { Parser, Language, type Tree } from 'web-tree-sitter';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { TSX_EXTENSION, LANGUAGE_GRAMMARS, GRAMMAR_FILE_EXTENSION } from '#cli/config/parsers/tree-sitter.ts';

import type {
    ParseCache,
    SourceTree,
    GrammarName,
    ParserState,
    SourceInput,
    ParsedSourceInput,
} from '#cli/types/parsers/tree-sitter.ts';

const TREE_MEMO = { create: () => new Map<string, Tree>() };

const state: ParserState = {
    runtime: undefined,
    parsers: new Map(),
};

async function buildParser(name: GrammarName): Promise<Parser> {
    state.runtime ??= Parser.init();
    await state.runtime;
    const language = await Language.load(readFileSync(wasmPath(`${name}${GRAMMAR_FILE_EXTENSION}`)));
    const parser = new Parser();
    parser.setLanguage(language);
    return parser;
}

// Reject a parse that returned no tree before a reader uses it.
function parseTree(parser: Parser, name: GrammarName, text: string): Tree {
    const tree = parser.parse(text);
    if (tree === null) throw new Error(`The ${name} parser returned no tree.`);
    return tree;
}

/**
 * The parser for a grammar, built on first use.
 * @param name the grammar.
 * @returns the parser.
 */
function parserFor(name: GrammarName): Promise<Parser> {
    let parser = state.parsers.get(name);
    if (parser === undefined) {
        parser = buildParser(name);
        state.parsers.set(name, parser);
    }
    return parser;
}

/**
 * Shares a run-owned parse while giving each reader its own disposable tree handle.
 * @param name the grammar that gives the source its meaning.
 * @param text the exact source to parse.
 * @param cache source reads and tree cleanup for this run.
 * @returns a caller-owned tree copy; throws when the parser produces no tree.
 */
export async function parseSource(name: GrammarName, text: string, cache?: ParseCache): Promise<Tree> {
    const parser = await parserFor(name);
    if (cache?.resources === undefined) return parseTree(parser, name, text);
    const trees = memo(cache.reads, TREE_MEMO);
    const key = JSON.stringify([name, text]);
    const held = trees.get(key);
    if (held !== undefined) return held.copy();
    const tree = parseTree(parser, name, text);
    trees.set(key, tree);
    cache.resources.defer(() => {
        trees.delete(key);
        tree.delete();
    });
    return tree.copy();
}

/**
 * Reads selected files and lends each parsed tree to a synchronous visitor, then releases its handle.
 * @param input the repository reads and files with their selected grammars.
 * @param visit the source inspection; syntax nodes must not escape this callback.
 * @returns after inspecting every selected source.
 */
export async function visitParsedSources(input: ParsedSourceInput, visit: (source: SourceTree) => void): Promise<void> {
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
 * @param path the file path.
 * @param language the language configuration the file belongs to.
 * @returns the grammar, or undefined for declaration files and languages without a grammar.
 */
export function grammarFor(path: string, language: string): GrammarName | undefined {
    if (DECLARATION_EXTENSIONS.some((extension) => path.endsWith(extension))) return undefined;
    const grammar = Object.entries(LANGUAGE_GRAMMARS).find(([configuration]) => configuration === language)?.[1];
    return grammar === 'typescript' && path.endsWith(TSX_EXTENSION) ? 'tsx' : grammar;
}

/**
 * Parse selected files once per run and release them with the run.
 * @param input the selected paths and source reads.
 * @param read the source parser.
 * @param dispose the operation that releases the parsed values.
 * @param resources the resources released at the end of the run.
 * @returns the parsed value, valid until disposing of the cleanup stack.
 */
export async function visitParsed<Value, Input extends SourceInput>(
    input: Input,
    read: (input: Input) => Promise<Value>,
    dispose: (value: Value) => void,
    resources: DisposableStack,
): Promise<Value> {
    const key = JSON.stringify([read.name, input.root, input.files.map((file) => file.path)]);
    let pending = input.reads.parsed.get(key);
    if (pending === undefined) {
        pending = read(input);
        input.reads.parsed.set(key, pending);
        try {
            // Each reader's name identifies its cached return type.
            const value = (await pending) as Value;
            resources.defer(() => {
                input.reads.parsed.delete(key);
                dispose(value);
            });
        } catch (error) {
            input.reads.parsed.delete(key);
            throw error;
        }
    }
    return (await pending) as Value;
}
