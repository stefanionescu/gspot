import { posix } from 'node:path';
import { readFileSync } from 'node:fs';
import { findWasmPath } from '#cli/system/assets.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { Parser, Language, type Tree } from 'web-tree-sitter';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';

import {
    GRAMMAR_EXTENSIONS,
    GRAMMAR_CONFIGURATIONS,
    GRAMMAR_FILE_EXTENSION,
} from '#cli/config/parsers/code/grammars.ts';
import type {
    ParseCache,
    SourceTree,
    GrammarName,
    ParserGrammars,
    GrammarSourceFiles,
} from '#cli/types/parsers/code/grammars.ts';

const PARSED_TREES = { create: () => new Map<string, Tree>() };

const grammars: ParserGrammars = {
    runtime: undefined,
    parsers: new Map(),
};

async function buildParser(name: GrammarName): Promise<Parser> {
    grammars.runtime ??= Parser.init();
    await grammars.runtime;
    const language = await Language.load(readFileSync(findWasmPath(`${name}${GRAMMAR_FILE_EXTENSION}`)));
    const parser = new Parser();
    parser.setLanguage(language);
    return parser;
}

function getParser(name: GrammarName): Promise<Parser> {
    let parser = grammars.parsers.get(name);
    if (parser === undefined) {
        parser = buildParser(name);
        grammars.parsers.set(name, parser);
    }
    return parser;
}

/**
Select the grammar of a code file by its extension alone.

@param path the file to parse.
@returns the grammar, or undefined for a file that no code grammar reads.
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
Share one parse per run, and give each reader its own tree handle to dispose.

@param name the grammar of the source.
@param text the exact source to parse.
@param cache source reads and tree cleanup for this run.
@returns a tree that the caller owns.
*/
export async function parseSource(name: GrammarName, text: string, cache?: ParseCache): Promise<Tree> {
    const parser = await getParser(name);
    if (cache?.resources === undefined) return parser.parse(text) as Tree;
    const trees = getCachedValue(cache.reads, PARSED_TREES);
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
Read the files, lend each parsed tree to a visitor, then release its handle.

@param sources the files to parse, each with its grammar.
@param visit reads one tree; syntax nodes must not leave this callback.
@returns a promise that settles after every file.
*/
export async function visitParsedSources(
    sources: GrammarSourceFiles,
    visit: (source: SourceTree) => void,
): Promise<void> {
    for (const file of sources.files) {
        const text = readCachedText(sources.reads, file.path);
        const tree = await parseSource(file.grammar, text, sources);
        try {
            visit({ path: file.path, text, rootNode: tree.rootNode });
        } finally {
            tree.delete();
        }
    }
}

/**
Select the grammar of a language configuration, with TSX for .tsx files.

@param path the file to parse.
@param language the configuration that owns the file.
@returns the grammar, or undefined for declaration files, settings files, and languages without a grammar.
*/
export function selectGrammar(path: string, language: string): GrammarName | undefined {
    if (!GRAMMAR_CONFIGURATIONS.has(language)) return undefined;
    if (language === 'bash' && posix.extname(path) === '') return 'bash';
    const found = findGrammarByExtension(path);
    return found === language || (language === 'typescript' && found === 'tsx') ? found : undefined;
}
