import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { setFlagsFromString } from 'node:v8';
import { remember } from '#cli/system/cache.ts';
import { setImmediate } from 'node:timers/promises';
import { readText } from '#cli/system/files/reads.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { Parser, Language, type Tree } from 'web-tree-sitter';
import { DECLARATION_EXTENSIONS } from '#cli/config/system.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import type { ParseCache, SourceTree, GrammarName, ParserGrammars, GrammarSourceFiles } from '#cli/types/parsers.ts';

import {
    GRAMMARS_FOLDER,
    SWIFT_WASM_FLAGS,
    GRAMMAR_EXTENSIONS,
    PARSES_BETWEEN_TURNS,
    GRAMMAR_CONFIGURATIONS,
    GRAMMAR_FILE_EXTENSION,
} from '#cli/config/parsers.ts';

const PARSED_TREES = Symbol('parsed trees');

const grammars: ParserGrammars = {
    runtime: undefined,
    parsers: new Map(),
    parses: 0,
};

function readGrammar(grammar: GrammarName): Buffer {
    try {
        return readFileSync(buildGrammarPath(grammar));
    } catch (error) {
        if (!hasErrorCode(error, 'ENOENT')) throw error;
        throw new GspotError('tool', `The ${grammar} grammar is not installed. Run gspot install.`, { cause: error });
    }
}

async function readLanguage(grammar: GrammarName): Promise<Language> {
    const bytes = readGrammar(grammar);
    try {
        return await Language.load(bytes);
    } catch (error) {
        throw new GspotError(
            'tool',
            `The ${grammar} grammar in ${buildGrammarPath(grammar)} is damaged. Run gspot install.`,
            { cause: error },
        );
    }
}

async function buildParser(grammar: GrammarName): Promise<Parser> {
    if (grammar === 'swift') for (const flag of SWIFT_WASM_FLAGS) setFlagsFromString(flag);
    grammars.runtime ??= Parser.init();
    await grammars.runtime;
    const language = await readLanguage(grammar);
    const parser = new Parser();
    parser.setLanguage(language);
    return parser;
}

function getParser(grammar: GrammarName): Promise<Parser> {
    const path = buildGrammarPath(grammar);
    let parser = grammars.parsers.get(path);
    if (parser === undefined) {
        parser = buildParser(grammar);
        grammars.parsers.set(path, parser);
        // A missing or damaged grammar stays out of the cache, so the next parse reads the file that install wrote.
        parser.catch(() => grammars.parsers.delete(path));
    }
    return parser;
}

/**
Build the path of an installed grammar. Every repository of this user shares the folder.

@param grammar the language syntax.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The parser reads the path through it, and the installer writes that path.
export function buildGrammarPath(grammar: GrammarName): string {
    return join(readCacheFolder(), GRAMMARS_FOLDER, `${grammar}${GRAMMAR_FILE_EXTENSION}`);
}

/**
Select the grammar of a code file by its extension alone.

@param path the file to parse.
@returns undefined for a file that no code grammar reads.
*/
export function findGrammarByExtension(path: string): GrammarName | undefined {
    if (DECLARATION_EXTENSIONS.some((extension) => path.endsWith(extension))) return undefined;
    const extension = posix.extname(path);
    if (extension === '') return undefined;
    return Object.entries(GRAMMAR_EXTENSIONS).find(([, extensions]) => extensions.includes(extension))?.[0] as
        GrammarName | undefined;
}

/**
Share one parse per run, and give each reader its own tree handle to dispose.

@param grammar the language syntax to parse.
@param text the exact source to parse.
@param cache source reads and tree cleanup for this run.
@returns the caller owns the tree, which frees itself on dispose.
*/
export async function parseSource(grammar: GrammarName, text: string, cache?: ParseCache): Promise<Tree & Disposable> {
    grammars.parses += 1;
    if (grammars.parses % PARSES_BETWEEN_TURNS === 0) await setImmediate();
    const parser = await getParser(grammar);
    const resources = cache?.resources;
    const tree =
        cache === undefined || resources === undefined
            ? (parser.parse(text) as Tree)
            : remember(cache.cache, PARSED_TREES, `${grammar}\0${text}`, () => {
                  const parsed = parser.parse(text) as Tree;
                  resources.push({
                      [Symbol.dispose]: () => {
                          parsed.delete();
                      },
                  });
                  return parsed;
              }).copy();
    return Object.assign(tree, {
        [Symbol.dispose]: () => {
            tree.delete();
        },
    });
}

/**
Read the files, lend each parsed tree to a visitor, then release its handle.

@param sources the files to parse, each with its grammar.
@param visit reads one tree; syntax nodes must not leave this callback.
*/
export async function visitParsedSources<Grammar extends GrammarName>(
    sources: GrammarSourceFiles<Grammar>,
    visit: (source: SourceTree<Grammar>) => void,
): Promise<void> {
    for (const file of sources.files) {
        const text = readText(sources.cache, file.path);
        using tree = await parseSource(file.grammar, text, sources);
        visit({ path: file.path, grammar: file.grammar, text, rootNode: tree.rootNode });
    }
}

/**
Select the grammar of a language configuration, with TSX for .tsx files.

@param path the file to parse.
@param language the configuration that owns the file.
@returns undefined for declaration files, settings files, and languages without a grammar.
*/
export function selectGrammar(path: string, language: string): GrammarName | undefined {
    if (!GRAMMAR_CONFIGURATIONS.has(language)) return undefined;
    if (language === 'bash' && posix.extname(path) === '') return 'bash';
    const found = findGrammarByExtension(path);
    return found === language || (language === 'typescript' && found === 'tsx') ? found : undefined;
}
