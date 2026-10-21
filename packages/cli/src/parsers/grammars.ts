// Reads grammars and shares source parses within a run.
import { posix } from 'node:path';
import { readFileSync } from 'node:fs';
import { findWasmPath } from '#cli/system/assets.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { Parser, Language, type Tree } from 'web-tree-sitter';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { GRAMMAR_EXTENSIONS, GRAMMAR_CONFIGURATIONS, GRAMMAR_FILE_EXTENSION } from '#cli/config/parsers/grammars.ts';

import type {
    ParseCache,
    SourceTree,
    GrammarName,
    ParserState,
    ParsedSourceInput,
} from '#cli/types/parsers/grammars.ts';

const TREE_MEMO = { create: () => new Map<string, Tree>() };

const state: ParserState = {
    runtime: undefined,
    parsers: new Map(),
};

async function buildParser(name: GrammarName): Promise<Parser> {
    state.runtime ??= Parser.init();
    await state.runtime;
    const language = await Language.load(readFileSync(findWasmPath(`${name}${GRAMMAR_FILE_EXTENSION}`)));
    const parser = new Parser();
    parser.setLanguage(language);
    return parser;
}

/**
 * Get the parser for a grammar, and build it on first use.
 *
 * @param name the grammar.
 * @returns the shared promise, which may still load the grammar.
 */
function getParser(name: GrammarName): Promise<Parser> {
    let parser = state.parsers.get(name);
    if (parser === undefined) {
        parser = buildParser(name);
        state.parsers.set(name, parser);
    }
    return parser;
}

/**
 * Select the grammar of a code file by its extension alone.
 *
 * @param path the file to parse.
 * @returns the grammar, or undefined for a file that no code grammar reads.
 */
export function findGrammarByExtension(path: string): GrammarName | undefined {
    if (DECLARATION_EXTENSIONS.some((extension) => path.endsWith(extension))) return undefined;
    const extension = posix.extname(path);
    if (extension === '') return undefined;
    return Object.entries(GRAMMAR_EXTENSIONS).find(([, extensions]) => extensions.includes(extension))?.[0] as
        | GrammarName
        | undefined;
}

/**
 * Share one parse per run, and give each reader its own tree handle to dispose.
 *
 * @param name the grammar of the source.
 * @param text the exact source to parse.
 * @param cache source reads and tree cleanup for this run.
 * @returns a tree that the caller owns.
 */
export async function parseSource(name: GrammarName, text: string, cache?: ParseCache): Promise<Tree> {
    const parser = await getParser(name);
    if (cache?.resources === undefined) return parser.parse(text) as Tree;
    const trees = getCachedValue(cache.reads, TREE_MEMO);
    const key = JSON.stringify([name, text]);
    const held = trees.get(key);
    if (held !== undefined) return held.copy();
    const tree = parser.parse(text) as Tree;
    trees.set(key, tree);
    cache.resources.defer(() => {
        trees.delete(key);
        tree.delete();
    });
    return tree.copy();
}

/**
 * Read the files, lend each parsed tree to a visitor, then release its handle.
 *
 * @param input the files to parse, each with its grammar.
 * @param visit reads one tree; syntax nodes must not leave this callback.
 * @returns a promise that settles after every file.
 */
export async function visitParsedSources(input: ParsedSourceInput, visit: (source: SourceTree) => void): Promise<void> {
    for (const file of input.files) {
        const text = readCachedText(input.reads, file.path);
        const tree = await parseSource(file.grammar, text, input);
        try {
            visit({ path: file.path, text, rootNode: tree.rootNode });
        } finally {
            tree.delete();
        }
    }
}

/**
 * Select the grammar of a language configuration, with TSX for .tsx files.
 *
 * @param path the file to parse.
 * @param language the configuration that owns the file.
 * @returns the grammar, or undefined for declaration files, settings files, and languages without a grammar.
 */
export function selectGrammar(path: string, language: string): GrammarName | undefined {
    if (!GRAMMAR_CONFIGURATIONS.has(language)) return undefined;
    if (language === 'bash' && posix.extname(path) === '') return 'bash';
    // A configuration also owns settings files, such as pyproject.toml; only its code files have a grammar.
    const found = findGrammarByExtension(path);
    return found === language || (language === 'typescript' && found === 'tsx') ? found : undefined;
}
