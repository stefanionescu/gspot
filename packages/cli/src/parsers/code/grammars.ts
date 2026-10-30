import { posix } from 'node:path';
import { readFileSync } from 'node:fs';
import { remember } from '#cli/system/cache.ts';
import { read } from '#cli/system/files/reads.ts';
import { buildAssetPath } from '#cli/system/assets.ts';
import { Parser, Language, type Tree } from 'web-tree-sitter';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/system.ts';

import {
    GRAMMARS_FOLDER,
    GRAMMAR_EXTENSIONS,
    GRAMMAR_CONFIGURATIONS,
    GRAMMAR_FILE_EXTENSION,
} from '#cli/config/parsers/code.ts';
import {
    type ParseCache,
    type SourceTree,
    type GrammarName,
    type ParserGrammars,
    type GrammarSourceFiles,
} from '#cli/types/parsers/code.ts';

const PARSED_TREES = Symbol('parsed trees');

const grammars: ParserGrammars = {
    runtime: undefined,
    parsers: new Map(),
};

async function buildParser(grammar: GrammarName): Promise<Parser> {
    grammars.runtime ??= Parser.init();
    await grammars.runtime;
    const grammarPath = posix.join(GRAMMARS_FOLDER, `${grammar}${GRAMMAR_FILE_EXTENSION}`);
    const language = await Language.load(readFileSync(buildAssetPath(grammarPath)));
    const parser = new Parser();
    parser.setLanguage(language);
    return parser;
}

function getParser(grammar: GrammarName): Promise<Parser> {
    let parser = grammars.parsers.get(grammar);
    if (parser === undefined) {
        parser = buildParser(grammar);
        grammars.parsers.set(grammar, parser);
    }
    return parser;
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
        | GrammarName
        | undefined;
}

/**
Share one parse per run, and give each reader its own tree handle to dispose.

@param grammar the language syntax to parse.
@param text the exact source to parse.
@param cache source reads and tree cleanup for this run.
@returns the caller owns the tree, which frees itself on dispose.
*/
export async function parseSource(grammar: GrammarName, text: string, cache?: ParseCache): Promise<Tree & Disposable> {
    const parser = await getParser(grammar);
    const resources = cache?.resources;
    const tree =
        cache === undefined || resources === undefined
            ? (parser.parse(text) as Tree)
            : remember(cache.cache, PARSED_TREES, `${grammar}\0${text}`, () => {
                  const parsed = parser.parse(text) as Tree;
                  resources.defer(() => {
                      parsed.delete();
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
export async function visitParsedSources(
    sources: GrammarSourceFiles,
    visit: (source: SourceTree) => void,
): Promise<void> {
    for (const file of sources.files) {
        const text = read(sources.cache, file.path);
        using tree = await parseSource(file.grammar, text, sources);
        visit({ path: file.path, text, rootNode: tree.rootNode });
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
